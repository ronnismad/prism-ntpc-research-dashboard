import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const file=new URL('../src/data/financials.json',import.meta.url);
const data=JSON.parse(readFileSync(file));
for(const source of data.sources)source.sha256=createHash('sha256').update(readFileSync(new URL('../public/'+source.file,import.meta.url))).digest('hex');
writeFileSync(file,JSON.stringify(data,null,2)+'\n');
