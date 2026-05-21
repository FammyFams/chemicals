// Run the real pdfjs extraction + parseSds on a local PDF file.
// Usage: tsx scripts/parse-file.ts <path-to.pdf>
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { parseSds } from '../src/lib/sds';

const require = createRequire(import.meta.url);
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
).href;

async function extractLines(data: Uint8Array): Promise<string[]> {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const frags = content.items
      .filter((it: any) => 'str' in it)
      .map((it: any) => ({ x: it.transform[4], y: it.transform[5], str: it.str }));
    const rows = new Map<number, { x: number; str: string }[]>();
    for (const f of frags) {
      const key = Math.round(f.y);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key)!.push({ x: f.x, str: f.str });
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      const line = rows.get(y)!.sort((a, b) => a.x - b.x).map((f) => f.str).join(' ')
        .replace(/\s+/g, ' ').trim();
      if (line) lines.push(line);
    }
  }
  return lines;
}

const path = process.argv[2];
const data = new Uint8Array(readFileSync(path));
const lines = await extractLines(data);
const comp = parseSds(lines);
console.log('found Section 3:', comp.found, '| ingredients:', comp.ingredients.length);
let sum = 0;
for (const i of comp.ingredients) {
  sum += i.estimatedPct;
  const range = i.min !== null && i.max !== null ? `${i.min}-${i.max}%` : i.concentrationRaw;
  console.log(`  ${i.name.slice(0, 42).padEnd(42)} CAS ${(i.cas || '—').padEnd(13)} ${range.padEnd(14)} prop=${i.isProprietary} est=${i.estimatedPct}%`);
}
console.log('estimated total:', Math.round(sum * 100) / 100, '%');
