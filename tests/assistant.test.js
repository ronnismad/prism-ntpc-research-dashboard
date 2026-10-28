import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {buildKnowledge,retrieve,validateSelection} from '../src/knowledge.js';
import {assistantMiddleware} from '../scripts/assistant_server.mjs';
const read=name=>JSON.parse(readFileSync(new URL('../src/data/'+name+'.json',import.meta.url)));
const cards=buildKnowledge(read('financials'),read('backtest'));
test('preset and typed questions retrieve relevant site evidence',()=>{
  for(const [question,id] of [
    ['Is NTPC worth investing in?','investment'],['Does cash cover capex, interest and dividends?','cash'],
    ['How accurate was the generation model?','backtest'],['How much debt does NTPC have?','debt'],
    ['What price passes the example valuation screen?','scenario'],['How does the pipeline avoid future inputs?','method'],
    ['What are the quarterly earnings?','earnings'],['Where do the numbers and sources come from?','sources']
  ])assert.ok(retrieve(question,cards).some(c=>c.id===id),question);
});
test('unknown, external-company, live-price and empty questions withhold answers',()=>{
  for(const q of ['', 'Hello', 'NTPC', 'Who is NTPC CEO?', 'What is Tesla earnings growth?', 'What is the price today?', 'What is the weather in Delhi?', 'Write a pasta recipe'])assert.deepEqual(retrieve(q,cards),[],q);
});
test('LLM output can select known IDs but cannot introduce factual prose or links',()=>{
  const selected=validateSelection({ids:['cash'],answer:'Invented profit 999',url:'https://example.com'},cards);
  assert.equal(selected[0],cards.find(c=>c.id==='cash'));
  assert.equal(selected[0].answer.includes('999'),false);
  for(const value of [null,{ids:['invented']},{ids:[{id:'cash'}]},{ids:['cash','debt','tax']},{answer:'BUY NOW'}])assert.deepEqual(validateSelection(value,cards),[]);
});
test('all source citations resolve to preserved assets or known routes',()=>{
  const routes=new Set(['investment','backtest','stations','methodology','evidence']);
  for(const card of cards){assert.ok(card.answer&&card.sources.length);for(const source of card.sources){if(source.route)assert.ok(routes.has(source.route));else assert.ok(existsSync(new URL('../public/'+source.file.split('#')[0],import.meta.url)),source.file);}}
});
test('evidence answers recompute when source amounts change',()=>{
  const changed=read('financials');changed.quote.close=200;
  assert.ok(buildKnowledge(changed,read('backtest')).find(c=>c.id==='valuation').answer.includes('₹200.00'));
  assert.ok(cards.find(c=>c.id==='cash').answer.includes('10,685.70'));
});
test('local middleware rejects cross-origin requests without contacting a model',async()=>{
  let status,body;const res={set statusCode(value){status=value;},setHeader(){},end(value){body=JSON.parse(value);}};
  await assistantMiddleware()({url:'/api/research-assistant/ask',method:'POST',headers:{origin:'https://unrelated.example',host:'127.0.0.1:5173'}},res,()=>assert.fail('unexpected next'));
  assert.equal(status,403);assert.match(body.error,/Same-origin/);
});
