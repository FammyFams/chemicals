// Real browser test of the upload -> parse -> render flow.
// Requires the dev server running at http://localhost:4321 and system Chrome.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const samplePdf = join(here, 'sample-sds.pdf');

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const errors: string[] = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));

await page.goto('http://localhost:4321/chemicals/', { waitUntil: 'networkidle' });

await page.setInputFiles('#file-input', samplePdf);
await page.waitForSelector('#results:not(.hidden)', { timeout: 15000 });

const rows = await page.$$eval('#rows tr', (trs) =>
  trs.map((tr) => {
    const td = tr.querySelectorAll('td');
    return {
      name: td[0]?.textContent?.trim() ?? '',
      cas: td[1]?.textContent?.trim() ?? '',
      range: td[2]?.textContent?.trim() ?? '',
      est: td[3]?.textContent?.trim() ?? '',
    };
  }),
);
const segWidths = await page.$$eval('#bar .seg', (segs) =>
  segs.map((s) => parseFloat((s as HTMLElement).style.width)),
);

console.log('console/page errors:', errors.length ? errors : 'none');
console.table(rows);
const total = segWidths.reduce((a, b) => a + b, 0);
console.log('bar segment count:', segWidths.length, '| total width %:', Math.round(total * 100) / 100);

const status = await page.textContent('#status');
console.log('status:', status?.trim());

await browser.close();

const ok =
  errors.length === 0 &&
  rows.length >= 4 &&
  rows.some((r) => /fragrance/i.test(r.name)) &&
  Math.abs(total - 100) < 1;
console.log(ok ? '\nPASS ✅' : '\nFAIL ❌');
process.exit(ok ? 0 : 1);
