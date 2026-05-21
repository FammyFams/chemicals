// End-to-end check of the real pdfjs extraction path (not just parseSds):
// build a positioned-text PDF that mimics an SDS Section 3 table, extract it
// with pdfjs using the SAME grouping logic as src/lib/pdf.ts, then parse.
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { parseSds } from '../src/lib/sds';

const require = createRequire(import.meta.url);
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
).href;

// (text, x, y) rows. y in PDF points from bottom; columns share a baseline.
type Cell = [string, number, number];
const cells: Cell[] = [
  ['SECTION 3: Composition / Information on Ingredients', 50, 700],
  ['Chemical Name', 50, 670], ['CAS-No.', 320, 670], ['Concentration', 430, 670],
  ['Acetone', 50, 650], ['67-64-1', 320, 650], ['30 - 60 %', 430, 650],
  ['Toluene', 50, 630], ['108-88-3', 320, 630], ['10 - 30 %', 430, 630],
  ['Proprietary surfactant blend', 50, 610], ['Trade Secret', 430, 610],
  ['SECTION 4: First-aid measures', 50, 580],
];

async function buildPdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const [text, x, y] of cells) {
    page.drawText(text, { x, y, size: 10, font });
  }
  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

// Mirror of src/lib/pdf.ts extractLines (worker import there is Vite-only).
async function extractLines(data: ArrayBuffer): Promise<string[]> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
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

const data = await buildPdf();
const lines = await extractLines(data);
console.log('--- extracted lines ---');
lines.forEach((l) => console.log('  ', JSON.stringify(l)));
console.log('\n--- parseSds ---');
const comp = parseSds(lines);
console.log('found:', comp.found);
let sum = 0;
for (const i of comp.ingredients) {
  sum += i.estimatedPct;
  console.log(`   ${i.name.padEnd(35)} CAS ${i.cas.padEnd(12)} prop=${i.isProprietary} est=${i.estimatedPct}%`);
}
console.log('estimated total:', Math.round(sum * 100) / 100, '%');
