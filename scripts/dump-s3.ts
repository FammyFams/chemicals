import { readFileSync } from 'node:fs';
import { extractLinesNode } from './pdf-node';
const data = new Uint8Array(readFileSync(process.argv[2]));
const lines = await extractLinesNode(data);
const start = lines.findIndex(l => /section\s*3|composition.*ingredient/i.test(l));
const end = lines.findIndex((l,i) => i>start && /section\s*4|first[\s-]?aid/i.test(l));
console.log('--- SECTION 3 RAW LINES ---');
lines.slice(start, end<0?start+25:end).forEach((l,i)=>console.log(String(i).padStart(2),JSON.stringify(l)));
