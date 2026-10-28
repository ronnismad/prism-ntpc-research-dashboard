import { pct, sum } from './analysis.js';
const time = date => Date.parse(`${date}T00:00:00Z`);
export function shiftDays(date, count) { return new Date(time(date)+count*86400000).toISOString().slice(0,10); }
const priorYear = date => `${Number(date.slice(0,4))-1}${date.slice(4)}`;
const byDate = (a,b)=>a.date.localeCompare(b.date);

function selectedRows(source, ids) {
  if(!source)return null;
  const rows=source.stations.filter(r=>ids.includes(r.id));
  return rows.length===ids.length && new Set(rows.map(r=>r.id)).size===ids.length ? rows : null;
}


export function predictQuarter(dataset, quarter, cutoffDay=60, state='All states') {
  const cutoff=shiftDays(quarter.start,cutoffDay-1);
  const eligible=dataset.snapshots.filter(s=>s.availableAt<=cutoff&&s.date<=cutoff);
  const ids=dataset.protocol.stationIds.filter(id=>state==='All states'||eligible.some(s=>s.stations.some(r=>r.id===id&&r.state===state)));
  const failure=reason=>({ready:false,quarter,cutoff,cutoffDay,reason});
  if(!ids.length)return failure('No stations match the selected state.');
  const lookup=date=>eligible.find(s=>s.date===date);
  const q1=quarter.start.slice(5)==='04-01';
  const baseDate=shiftDays(quarter.start,-1);
  const base=q1?null:lookup(baseDate);
  const priorBase=q1?null:lookup(priorYear(baseDate));
  const priorEnd=lookup(priorYear(quarter.end));
  const observation=eligible.filter(s=>s.date>=quarter.start&&s.date<quarter.end&&selectedRows(s,ids)).sort(byDate).at(-1);
  if(!observation)return failure('No captured current-quarter observation was available by this cutoff.');
  const currentRows=selectedRows(observation,ids);
  const baseRows=q1?[]:selectedRows(base,ids);
  const priorBaseRows=q1?[]:selectedRows(priorBase,ids);
  const priorEndRows=selectedRows(priorEnd,ids);
  if(!baseRows||!priorBaseRows||!priorEndRows)return failure('A matching quarter-start or prior-year baseline report is missing or was not yet available.');
  const observed=sum(currentRows,'ytdActual')-sum(baseRows,'ytdActual');
  const baseline=sum(priorEndRows,'ytdActual')-sum(priorBaseRows,'ytdActual');
  if(observed<0||baseline<=0)return failure('A negative cumulative change or invalid baseline prevents comparison.');
  const priorObservation=lookup(priorYear(observation.date));
  const priorObservationRows=selectedRows(priorObservation,ids);
  if(!priorObservationRows)return failure('The prior-year matched-date observation for the seasonal-profile baseline is missing.');
  const priorQtd=sum(priorObservationRows,'ytdActual')-sum(priorBaseRows,'ytdActual');
  if(priorQtd<=0)return failure('Invalid prior-year quarter-to-date generation for the seasonal-profile baseline.');
  const elapsed=Math.round((time(observation.date)-time(quarter.start))/86400000)+1;
  return {ready:true,quarter,cutoff,cutoffDay,ids,observation,base,priorBase,priorEnd,priorObservation,priorQtd,
    baseActual:sum(baseRows,'ytdActual'),observed,elapsed,baseline,
    forecast:observed/elapsed*quarter.days,seasonalForecast:observed*baseline/priorQtd,
    inputDates:[base,priorBase,priorEnd,priorObservation,observation].filter(Boolean).map(s=>({date:s.date,availableAt:s.availableAt,file:s.file}))};
}


export function scoreQuarter(dataset, prediction) {
  if(!prediction.ready)return prediction;
  const outcome=dataset.snapshots.find(s=>s.date===prediction.quarter.end);
  const finalRows=selectedRows(outcome,prediction.ids);
  if(!finalRows)return {...prediction,ready:false,reason:'The matching final outcome is unavailable.'};
  const actual=sum(finalRows,'ytdActual')-prediction.baseActual;
  if(actual<=0)return {...prediction,ready:false,reason:'The final cumulative change is invalid.'};
  const error=prediction.forecast-actual;
  const baselineError=prediction.baseline-actual;
  const seasonalError=prediction.seasonalForecast-actual;
  const remainingActual=actual-prediction.observed;
  const direction=value=>Math.abs(value)<1e-9?0:Math.sign(value);
  return {...prediction,outcome,actual,error,baselineError,seasonalError,remainingActual,
    remainingApe:remainingActual>0?Math.abs(error)/remainingActual*100:null,
    remainingSeasonalApe:remainingActual>0?Math.abs(seasonalError)/remainingActual*100:null,
    ape:Math.abs(error)/actual*100,baselineApe:Math.abs(baselineError)/actual*100,
    seasonalApe:Math.abs(seasonalError)/actual*100,
    bias:error/actual*100,actualChange:pct(actual,prediction.baseline),
    forecastChange:pct(prediction.forecast,prediction.baseline),
    directionCorrect:direction(prediction.forecast-prediction.baseline)===direction(actual-prediction.baseline),
    win:Math.abs(error)<Math.abs(baselineError)-1e-8,
    seasonalWin:Math.abs(error)<Math.abs(seasonalError)-1e-8};
}

export function runBacktest(dataset,cutoffDay=60,state='All states') {
  const all=dataset.protocol.quarters.map(q=>scoreQuarter(dataset,predictQuarter(dataset,q,cutoffDay,state)));
  const rows=all.filter(r=>r.ready);
  const skipped=all.filter(r=>!r.ready);
  if(!rows.length)return {rows,skipped,count:0};
  const mean=key=>rows.reduce((a,r)=>a+r[key],0)/rows.length;
  const actualTotal=rows.reduce((a,r)=>a+r.actual,0);
  const errors=rows.reduce((a,r)=>a+Math.abs(r.error),0);
  const baselineErrors=rows.reduce((a,r)=>a+Math.abs(r.baselineError),0);
  const seasonalErrors=rows.reduce((a,r)=>a+Math.abs(r.seasonalError),0);
  const remainderRows=rows.filter(r=>r.remainingActual>0);
  return {rows,skipped,count:rows.length,mape:mean('ape'),baselineMape:mean('baselineApe'),
    mae:errors/rows.length,baselineMae:baselineErrors/rows.length,
    wape:errors/actualTotal*100,baselineWape:baselineErrors/actualTotal*100,
    bias:mean('bias'),wins:rows.filter(r=>r.win).length,
    seasonalMape:mean('seasonalApe'),seasonalMae:seasonalErrors/rows.length,
    seasonalWins:rows.filter(r=>r.seasonalWin).length,
    remainingMape:remainderRows.length?remainderRows.reduce((a,r)=>a+r.remainingApe,0)/remainderRows.length:null,
    remainingSeasonalMape:remainderRows.length?remainderRows.reduce((a,r)=>a+r.remainingSeasonalApe,0)/remainderRows.length:null,
    seasonalImprovement:seasonalErrors>0?(1-errors/seasonalErrors)*100:null,
    directionHits:rows.filter(r=>r.directionCorrect).length,
    improvement:baselineErrors>0?(1-errors/baselineErrors)*100:null};
}

export function backtestCsv(result) {
  const header=['quarter','research_cutoff','observation_date','observation_available_at','observed_days','run_rate_BU','seasonal_profile_BU','unchanged_prior_year_BU','actual_BU','run_rate_APE_pct','seasonal_profile_APE_pct','prior_year_APE_pct','signed_error_pct','direction_correct','beat_seasonal_profile','remaining_actual_BU','remaining_run_rate_APE_pct','remaining_seasonal_APE_pct','input_sources','outcome_source'];
  const rows=result.rows.map(r=>[r.quarter.label,r.cutoff,r.observation.date,r.observation.availableAt,r.elapsed,r.forecast/1000,r.seasonalForecast/1000,r.baseline/1000,r.actual/1000,r.ape,r.seasonalApe,r.baselineApe,r.bias,r.directionCorrect,r.seasonalWin,r.remainingActual/1000,r.remainingApe,r.remainingSeasonalApe,r.inputDates.map(s=>s.file).join(';'),r.outcome.file]);
  return [header,...rows].map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n');
}

export function valuation(price,eps,dividend) {
  const p=Number(price),e=Number(eps),d=Number(dividend);
  return {pe:price!==''&&eps!==''&&Number.isFinite(p)&&Number.isFinite(e)&&p>0&&e>0?p/e:null,
    yield:price!==''&&dividend!==''&&Number.isFinite(p)&&Number.isFinite(d)&&p>0&&d>=0?d/p*100:null};
}
