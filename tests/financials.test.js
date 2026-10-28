import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {financialMetrics,valuationScenario} from '../src/financials.js';
const data=JSON.parse(readFileSync(new URL('../src/data/financials.json',import.meta.url)));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('TTM earnings replace the comparable quarter rather than annualizing Q1',()=>{
  const m=financialMetrics(data); near(m.ttmEps,28.63);near(m.pe,303.75/28.63);
});
test('cash bridge charges financing interest before assessing equity cash',()=>{
  const m=financialMetrics(data);near(m.afterCapex,6852.03);near(m.afterInterest,-10685.70);near(m.afterDividends,-19444.96);
  assert.ok(m.cashConversion>1 && m.afterInterest<0);
});
test('book value uses parent equity; net debt includes leases and only cash equivalents',()=>{
  const m=financialMetrics(data);near(m.bookValue,203175.67/969.667);near(m.netDebt,267582.95);
});
test('scenario entry threshold includes a margin of safety and rejects invalid inputs',()=>{
  const s=valuationScenario(28.63,303.75,15,12,15);near(s.eps,24.3355);near(s.entry,248.2221);
  assert.equal(s.passes,false);assert.equal(valuationScenario(28.63,200,15,12,15).passes,true);
  for(const args of [[28,0,15,12,15],[28,300,100,12,15],[28,300,15,-1,15],[28,300,15,12,100],[28,NaN,15,12,15]])assert.equal(valuationScenario(...args),null);
});
test('financial sources retain original bytes and the exchange quote matches NTPC EQ',()=>{
  for(const s of data.sources){const file=new URL('../public/'+s.file,import.meta.url);assert.ok(existsSync(file));assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),s.sha256);assert.ok(s.published<=data.capturedAt);}
  const csv=readFileSync(new URL('../public/'+data.sources.find(s=>s.id==='nse').file,import.meta.url),'utf8');
  const row=csv.split(/\r?\n/).map(r=>r.split(',').map(c=>c.trim())).find(r=>r[0]==='NTPC'&&r[1]==='EQ');
  assert.equal(row[2],'28-Oct-2026');near(Number(row[8]),data.quote.close);
});
