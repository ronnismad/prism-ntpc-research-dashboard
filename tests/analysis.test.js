import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyse, availableSnapshots, csvExport, evaluate } from '../src/analysis.js';
const data = JSON.parse(readFileSync(new URL('../src/data/generation.json', import.meta.url)));

test('no unavailable observation enters a historical prediction', () => {
  const cutoff='2025-11-17';
  const model=analyse(data,cutoff);
  assert.ok(model.ready);
  assert.ok(model.available.every(s=>s.availableAt<=cutoff));
  const poisoned=structuredClone(data);
  for(const s of poisoned.snapshots.filter(s=>s.availableAt>cutoff))for(const r of s.stations)r.ytdActual=999999999;
  const after=analyse(poisoned,cutoff);
  assert.equal(after.projection,model.projection);
  assert.equal(after.actual,model.actual);
  assert.deepEqual(after.points,model.points);
});
test('full quarter observation equals quarter projection',()=>{
  const model=analyse(data,'2026-01-30');
  assert.equal(model.elapsed,92);
  assert.ok(Math.abs(model.projection-model.actual)<1e-8);
});
test('before evidence is available the model withholds results',()=>{
  assert.equal(analyse(data,'2025-10-01').ready,false);
});
test('state-filtered samples aggregate to the unfiltered total',()=>{
  const model=analyse(data,'2025-12-17');
  const states=[...new Set(model.rows.map(r=>r.state))];
  const total=states.reduce((a,s)=>a+analyse(data,'2025-12-17',s).actual,0);
  assert.ok(Math.abs(total-model.actual)<1e-7);
});
test('every snapshot has exactly eight unique, complete station rows',()=>{
  for(const snapshot of data.snapshots){
    assert.equal(snapshot.stations.length,8);
    assert.equal(new Set(snapshot.stations.map(r=>r.id)).size,8);
    assert.equal(snapshot.sha256.length,64);
    assert.ok(snapshot.availableAt>snapshot.issuedOn);
    for(const r of snapshot.stations){
      assert.ok(r.ytdActual>=0 && r.capacity>0 && r.outage>=0);
      assert.ok(r.page>0);
    }
  }
});
test('source report bytes match the preserved fingerprints',async()=>{
  const {createHash}=await import('node:crypto');
  for(const s of data.snapshots){
    const bytes=readFileSync(new URL(`../public/${s.file}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),s.sha256);
  }
});
test('baseline, outcomes and exports keep their meanings separate',()=>{
  const model=analyse(data,'2025-12-17');
  const evaluation=evaluate(data,model);
  assert.ok(evaluation.final.availableAt>'2025-12-17');
  assert.ok(Number.isFinite(evaluation.runRateError));
  const csv=csvExport(model,'2025-12-17');
  assert.equal(csv.split('\r\n').length,9);
  assert.ok(!csv.includes('2025-12-31'));
  assert.ok(!availableSnapshots(data,'2025-12-17').includes(evaluation.final));
});
