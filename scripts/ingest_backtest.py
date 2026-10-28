




import calendar
import concurrent.futures
import datetime as dt
import json
import time
from pathlib import Path
from ingest import download, STATIONS

ROOT = Path(__file__).resolve().parents[1]
QUARTERS = []
for year in (2024, 2025):
    for month in (4, 7, 10, 1):
        actual_year = year + (month == 1)
        start = dt.date(actual_year, month, 1)
        end_month = month + 2
        end = dt.date(actual_year, end_month, calendar.monthrange(actual_year, end_month)[1])
        fiscal_quarter = {4:1, 7:2, 10:3, 1:4}[month]
        QUARTERS.append({'id': f'Q{fiscal_quarter}-FY{str(year+1)[-2:]}',
            'label': f'Q{fiscal_quarter} FY{str(year+1)[-2:]}',
            'start': start.isoformat(), 'end': end.isoformat(),
            'days': (end-start).days+1})

def dates_for(q):
    start=dt.date.fromisoformat(q['start'])
    end=dt.date.fromisoformat(q['end'])
    dates={end, end.replace(year=end.year-1)}
    if start.month != 4:
        baseline=start-dt.timedelta(days=1)
        dates.update([baseline, baseline.replace(year=baseline.year-1)])
    observations=[start+dt.timedelta(days=n-1) for n in [40,55,70]]
    dates.update(observations)
    dates.update(d.replace(year=d.year-1) for d in observations)
    return {d.isoformat() for d in dates}

def fetch(date):
    error=None
    for attempt in range(2):
        try:
            return download(date), None
        except Exception as exc:
            error=str(exc)
            if attempt==0:
                time.sleep(1)
    return None, {'date':date, 'reason':error}

if __name__=='__main__':
    dates=sorted(set().union(*(dates_for(q) for q in QUARTERS)))
    snapshots=[]
    failures=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        jobs={pool.submit(fetch,date):date for date in dates}
        for job in concurrent.futures.as_completed(jobs):
            result,error=job.result()
            if result:
                snapshots.append(result)
                print(f"OK {result['date']} available {result['availableAt']}",flush=True)
            else:
                failures.append(error)
                print(f"SKIP {error['date']}: {error['reason']}",flush=True)
    payload={'retrievedOn':dt.date(2026,10,29).isoformat(),
        'protocol':{'version':'1.0','quarters':QUARTERS,'cutoffDays':[45,60,75],
            'captureDays':[40,55,70],'stationIds':list(STATIONS),
            'availabilityRule':'One day after the printed PDF generation date. Proxy only, not first-seen publication evidence.',
            'selectionRule':'Latest captured current-quarter observation available by the fixed cutoff; final quarter outcomes excluded.',
            'baselineRule':'Compare both unchanged prior-year total and a seasonal-profile forecast: current QTD * prior-year full-quarter / prior-year QTD on the same calendar date.',
            'sampleRule':'Eight preselected NTPC thermal stations. No whole-company or stock-return inference.'},
        'snapshots':sorted(snapshots,key=lambda s:s['date']),'captureFailures':failures}
    target=ROOT/'src'/'data'/'backtest.json'
    target.write_text(json.dumps(payload,indent=2),encoding='utf-8')
    print(f'Wrote {len(snapshots)} reports; {len(failures)} failures.',flush=True)
