




import concurrent.futures
import datetime as dt
import hashlib
import io
import json
import re
import urllib.request
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'public' / 'sources'
SOURCES.mkdir(parents=True, exist_ok=True)
DATES = ['2024-09-30', '2024-12-31', '2025-09-30', '2025-10-15',
         '2025-10-31', '2025-11-15', '2025-11-30', '2025-12-15', '2025-12-31']
STATIONS = {
    'RIHAND STPS': ('Rihand', 'Uttar Pradesh'),
    'SINGRAULI STPS': ('Singrauli', 'Uttar Pradesh'),
    'KORBA STPS': ('Korba', 'Chhattisgarh'),
    'SIPAT STPS': ('Sipat', 'Chhattisgarh'),
    'VINDHYACHAL STPS': ('Vindhyachal', 'Madhya Pradesh'),
    'KUDGI STPP': ('Kudgi', 'Karnataka'),
    'FARAKKA STPS': ('Farakka', 'West Bengal'),
    'TALCHER STPS': ('Talcher', 'Odisha'),
}

def download(day):
    date = dt.date.fromisoformat(day)
    url = f'https://npp.gov.in/public-reports/cea/daily/dgr/{date:%d-%m-%Y}/dgr9-{day}.pdf'
    file = SOURCES / f'cea-ntpc-{day}.pdf'
    if file.exists():
        data = file.read_bytes()
    else:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=35) as res:
            data = res.read()
        if not data.startswith(b'%PDF'):
            raise ValueError(f'Not a PDF: {day}')
        file.write_bytes(data)
    reader = PdfReader(io.BytesIO(data))
    pages = [p.extract_text() for p in reader.pages]
    text = '\n'.join(pages)
    stamps = re.findall(r'(\d{2}/\d{2}/\d{4})\s+\d{2}[.:]\d{2}[.:]\d{2}', text)
    if not stamps:
        raise ValueError(f'No report timestamp: {day}')
    issued = max(dt.datetime.strptime(s, '%d/%m/%Y').date() for s in stamps)
                                                                                       
    available = issued + dt.timedelta(days=1)
    stations = []
    for key, (name, state) in STATIONS.items():
        matches = []
        for page_index, page in enumerate(pages):
            match = re.search(re.escape(key) + r'\s+((?:\d+[.]\d+\s+){5}\d+[.]\d+)([^\n]*)', page)
            if match:
                values = [float(v) for v in match.group(1).split()]
                tail = [float(v) for v in re.findall(r'\d+[.]\d+', match.group(2))]
                matches.append({'id': key, 'name': name, 'state': state,
                    'capacity': values[0], 'availableCapacity': values[1],
                    'programme': values[2], 'actual': values[3],
                    'ytdProgramme': values[4], 'ytdActual': values[5],
                    'outage': tail[-1] if tail else None, 'page': page_index + 1})
        if len(matches) != 1:
            raise ValueError(f'{day}: expected one station row for {key}, got {len(matches)}')
        stations.extend(matches)
    return {'date': day, 'issuedOn': issued.isoformat(), 'availableAt': available.isoformat(),
            'url': url, 'file': f'sources/{file.name}', 'sha256': hashlib.sha256(data).hexdigest(),
            'stations': stations}

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(download, DATES))
    payload = {'retrievedOn': '2026-10-28', 'scope': 'Eight selected NTPC thermal stations',
               'unit': 'MU', 'snapshots': sorted(results, key=lambda r:r['date'])}
    target = ROOT / 'src' / 'data' / 'generation.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, indent=2), encoding='utf-8')
    print(f'Saved {len(results)} source snapshots, {len(STATIONS)} stations each.')
