export const QUARTER = { start: '2025-10-01', end: '2025-12-31', days: 92, label: 'Q3 FY26' };
const day = (date) => Date.parse(`${date}T00:00:00Z`);
export const daysSinceStart = date => Math.round((day(date) - day(QUARTER.start)) / 86400000) + 1;
export const sum = (rows, key) => rows.reduce((a, row) => a + row[key], 0);
export const pct = (value, base) => base ? (value / base - 1) * 100 : null;
export const fmt = (n, digits = 1) => Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
export const signed = (n, digits = 1) => Number.isFinite(n) ? `${n > 0 ? '+' : ''}${fmt(n, digits)}` : '—';
export const dateLabel = value => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));

export function availableSnapshots(data, cutoff) {
  return data.snapshots.filter(s => s.availableAt <= cutoff && s.date <= cutoff);
}

export function analyse(data, cutoff, state = 'All states') {
  const available = availableSnapshots(data, cutoff);
  const find = date => available.find(s => s.date === date);
  const base = find('2025-09-30');
  const priorBase = find('2024-09-30');
  const priorEnd = find('2024-12-31');
  const current = available.filter(s => s.date >= QUARTER.start && s.date <= QUARTER.end).sort((a, b) => a.date.localeCompare(b.date));
  const latest = current.at(-1);
  const filter = s => s?.stations.filter(r => state === 'All states' || r.state === state) || [];
  const rows = filter(latest);
  const ids = rows.map(r => r.id);
  const matched = s => filter(s).filter(r => ids.includes(r.id));
  if (!latest || !base || !priorBase || !priorEnd || rows.length === 0) return { ready: false, available, current, rows: [], reason: 'No complete quarter-to-date observation is available at this cutoff. Move the date forward until a current-quarter report is available.' };
  for (const source of [base, priorBase, priorEnd, ...current]) {
    if (matched(source).length !== rows.length) return { ready: false, available, current, rows: [], reason: 'The station set is incomplete. Comparison withheld to avoid changing the sample.' };
  }
  const baseActual = sum(matched(base), 'ytdActual');
  const baseProgramme = sum(matched(base), 'ytdProgramme');
  const baseline = sum(matched(priorEnd), 'ytdActual') - sum(matched(priorBase), 'ytdActual');
  const actual = sum(rows, 'ytdActual') - baseActual;
  const programme = sum(rows, 'ytdProgramme') - baseProgramme;
  const elapsed = daysSinceStart(latest.date);
  const projection = actual / elapsed * QUARTER.days;
  const stationRows = rows.map(r => {
    const b = matched(base).find(x => x.id === r.id);
    const pyStart = matched(priorBase).find(x => x.id === r.id);
    const pyEnd = matched(priorEnd).find(x => x.id === r.id);
    const generated = r.ytdActual - b.ytdActual;
    const planned = r.ytdProgramme - b.ytdProgramme;
    const prior = pyEnd.ytdActual - pyStart.ytdActual;
    return { ...r, generated, planned, prior, projected: generated / elapsed * QUARTER.days, deviation: pct(generated, planned) };
  });
  const points = [{ date: '2025-09-30', day: 0, actual: 0, programme: 0 }];
  for (const snapshot of current) {
    const records = matched(snapshot);
    points.push({ date: snapshot.date, day: daysSinceStart(snapshot.date), actual: (sum(records, 'ytdActual') - baseActual) / 1000, programme: (sum(records, 'ytdProgramme') - baseProgramme) / 1000, availableAt: snapshot.availableAt });
  }
  const last = points.at(-1);
  last.projected = last.actual;
  if (last.day < QUARTER.days) points.push({ date: QUARTER.end, day: QUARTER.days, projected: projection / 1000 });
  for (const point of points) point.baseline = baseline * point.day / QUARTER.days / 1000;
  return { ready: true, available, current, latest, base, priorBase, priorEnd, rows: stationRows, points, actual, programme, baseline, elapsed, projection, capacity: sum(rows, 'capacity'), outage: sum(rows, 'outage'), deviation: pct(actual, programme), projectedChange: pct(projection, baseline) };
}



export function evaluate(data, model, state = 'All states') {
  if (!model.ready || model.latest.date === QUARTER.end) return null;
  const final = data.snapshots.find(s => s.date === QUARTER.end);
  if (!final) return null;
  const ids = model.rows.map(r => r.id);
  const finalRows = final.stations.filter(r => ids.includes(r.id));
  if (finalRows.length !== ids.length) return null;
  const actual = sum(finalRows, 'ytdActual') - sum(model.base.stations.filter(r => ids.includes(r.id)), 'ytdActual');
  return { actual, runRateError: pct(model.projection, actual), baselineError: pct(model.baseline, actual), final };
}

export function csvExport(model, cutoff) {
  if (!model.ready) return '';
  const header = ['as_of', 'observation_date', 'station', 'state', 'quarter_generation_MU', 'quarter_programme_MU', 'run_rate_projection_MU', 'capacity_MW', 'outage_MW', 'source_url', 'source_page'];
  const rows = model.rows.map(r => [cutoff, model.latest.date, r.name, r.state, r.generated.toFixed(2), r.planned.toFixed(2), r.projected.toFixed(2), r.capacity, r.outage, model.latest.url, r.page]);
  return [header, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
}
