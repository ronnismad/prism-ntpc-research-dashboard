import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {predictQuarter,runBacktest,scoreQuarter,backtestCsv,shiftDays,valuation} from '../src/backtest.js';
const data=JSON.parse(readFileSync(new URL('../src/data/backtest.json',import.meta.url)));

test('study has eight distinct quarters and 24 scored forecasts, not 24 independent periods',()=>{
  assert.equal(data.protocol.quarters.length,8);
  assert.equal(new Set(data.protocol.quarters.map(q=>q.id)).size,8);
  assert.deepEqual(data.protocol.cutoffDays,[45,60,75]);
  for(const day of data.protocol.cutoffDays){const r=runBacktest(data,day);assert.equal(r.count,8);assert.equal(r.skipped.length,0);}
});
test('changing later outcomes cannot change any frozen forecast or baseline',()=>{
  for(const q of data.protocol.quarters)for(const day of data.protocol.cutoffDays){
    const before=predictQuarter(data,q,day);
    assert.ok(before.ready);
    const poisoned=structuredClone(data);
    for(const source of poisoned.snapshots.filter(s=>s.availableAt>before.cutoff||s.date>before.cutoff))for(const r of source.stations){r.ytdActual=999999999;r.actual=123456789;}
    const after=predictQuarter(poisoned,q,day);
    assert.equal(after.forecast,before.forecast);
    assert.equal(after.seasonalForecast,before.seasonalForecast);
    assert.equal(after.baseline,before.baseline);
    assert.deepEqual(after.inputDates,before.inputDates);
    assert.ok(before.inputDates.every(s=>s.availableAt<=before.cutoff&&s.date<=before.cutoff));
    assert.ok(!before.inputDates.some(s=>s.date===q.end));
  }
});
test('Q1 starts from fiscal zero rather than subtracting the previous March',()=>{
  const q=data.protocol.quarters[0];
  const r=predictQuarter(data,q,60);
  const sum=r.observation.stations.reduce((a,s)=>a+s.ytdActual,0);
  assert.equal(r.base,null);
  assert.equal(r.priorBase,null);
  assert.equal(r.baseActual,0);
  assert.equal(r.observed,sum);
  assert.ok(Math.abs(scoreQuarter(data,r).actual-42982.96)<1e-6);
});
test('seasonal-profile baseline uses matched prior-year QTD, not future actuals',()=>{
  const r=predictQuarter(data,data.protocol.quarters[4],60);
  assert.equal(r.priorObservation.date,'2024-05-25');
  assert.ok(Math.abs(r.seasonalForecast-r.observed*r.baseline/r.priorQtd)<1e-9);
  assert.notEqual(r.seasonalForecast,r.baseline);
});
test('missing prior-year evidence excludes every dependent quarter explicitly',()=>{
  const broken=structuredClone(data);
  broken.snapshots=broken.snapshots.filter(s=>s.date!=='2023-06-30');
  const r=runBacktest(broken,60);
  assert.equal(r.count,6);
  assert.deepEqual(r.skipped.map(s=>s.quarter.id),['Q1-FY25','Q2-FY25']);
  assert.match(r.skipped[0].reason,/baseline/);
});
test('state samples add up and do not mix station identities',()=>{
  const full=runBacktest(data,60);
  const states=[...new Set(data.snapshots.at(-1).stations.map(r=>r.state))];
  const scoped=states.map(s=>runBacktest(data,60,s));
  for(let i=0;i<8;i++){
    for(const key of ['actual','forecast','baseline','observed'])assert.ok(Math.abs(scoped.reduce((a,s)=>a+s.rows[i][key],0)-full.rows[i][key])<1e-6);

  }
});
test('metric calculations match independently recomputed errors',()=>{
  const r=runBacktest(data,60);
  const mape=r.rows.reduce((a,s)=>a+Math.abs((s.forecast-s.actual)/s.actual)*100,0)/8;
  const profileMape=r.rows.reduce((a,s)=>a+Math.abs((s.seasonalForecast-s.actual)/s.actual)*100,0)/8;
  assert.ok(Math.abs(r.mape-mape)<1e-10);
  assert.ok(Math.abs(r.seasonalMape-profileMape)<1e-10);
  assert.equal(r.seasonalWins,5);
  assert.ok(r.remainingMape>r.mape);
  assert.ok(r.remainingSeasonalMape>r.seasonalMape);
  assert.ok(Math.abs(r.mape-1.5016764823435735)<1e-9);
  assert.equal(backtestCsv(r).split('\r\n').length,9);
});
test('all 48 source reports have complete distinct station rows and unchanged hashes',()=>{
  assert.equal(data.snapshots.length,48);
  assert.equal(data.captureFailures.length,0);
  for(const s of data.snapshots){
    assert.equal(s.stations.length,8);
    assert.equal(new Set(s.stations.map(r=>r.id)).size,8);
    assert.ok(s.availableAt>s.issuedOn);
    const bytes=readFileSync(new URL(`../public/${s.file}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),s.sha256);
  }
});
test('calendar day counting preserves leap-year quarter lengths',()=>{
  assert.equal(shiftDays('2025-01-01',59),'2025-03-01');
  assert.equal(shiftDays('2024-01-01',59),'2024-02-29');
});
test('valuation worksheet keeps blank, negative and zero-earnings cases explicit',()=>{
  assert.deepEqual(valuation('','',''),{pe:null,yield:null});
  assert.deepEqual(valuation('300','20','9'),{pe:15,yield:3});
  assert.equal(valuation('300','0','9').pe,null);
  assert.equal(valuation('300','-2','9').pe,null);
  assert.equal(valuation('0','20','9').yield,null);
  assert.equal(valuation('300','20','-1').yield,null);
  assert.equal(valuation('300','Infinity','9').pe,null);
});
