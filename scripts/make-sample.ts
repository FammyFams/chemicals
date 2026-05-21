// Generates scripts/sample-sds.pdf: a positioned-text PDF that mimics an SDS
// Section 3 table, for manual upload testing and the Playwright check.
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

type Cell = [string, number, number];
const cells: Cell[] = [
  ['SAFETY DATA SHEET — Multi-Surface Cleaner', 50, 740],
  ['SECTION 3: Composition / Information on Ingredients', 50, 700],
  ['Chemical Name', 50, 670], ['CAS-No.', 320, 670], ['Concentration', 430, 670],
  ['Water', 50, 650], ['7732-18-5', 320, 650], ['60 - 80 %', 430, 650],
  ['2-Butoxyethanol', 50, 630], ['111-76-2', 320, 630], ['5 - 10 %', 430, 630],
  ['Sodium hydroxide', 50, 610], ['1310-73-2', 320, 610], ['< 1 %', 430, 610],
  ['Proprietary fragrance blend', 50, 590], ['Trade Secret', 430, 590],
  ['SECTION 4: First-aid measures', 50, 560],
];

const doc = await PDFDocument.create();
const page = doc.addPage([612, 792]);
const font = await doc.embedFont(StandardFonts.Helvetica);
for (const [text, x, y] of cells) page.drawText(text, { x, y, size: 10, font });

const out = join(dirname(fileURLToPath(import.meta.url)), 'sample-sds.pdf');
writeFileSync(out, await doc.save());
console.log('wrote', out);
