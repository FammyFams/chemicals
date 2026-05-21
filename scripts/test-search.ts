// Browser test: typing "deet" finds the baked-in product and renders it.
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto('http://localhost:4321/chemicals/', { waitUntil: 'networkidle' });
await page.fill('#product-search', 'deet');
await page.waitForSelector('#search-results li', { timeout: 8000 });
const resultText = await page.textContent('#search-results li');
console.log('first result:', resultText?.trim());

await page.click('#search-results li');
await page.waitForSelector('#results:not(.hidden)', { timeout: 8000 });
const rows = await page.$$eval('#rows tr td:first-child', (tds) => tds.map((t) => t.textContent?.trim() ?? ''));
const segTotal = await page.$$eval('#bar .seg', (segs) =>
  segs.reduce((a, s) => a + parseFloat((s as HTMLElement).style.width), 0),
);
await browser.close();

console.log('page errors:', errors.length ? errors : 'none');
console.log('rendered rows:', rows);
console.log('bar total %:', Math.round(segTotal * 100) / 100);

const ok =
  errors.length === 0 &&
  rows.some((r) => /toluamide|deet/i.test(r)) &&
  Math.abs(segTotal - 100) < 1;
console.log(ok ? '\nPASS ✅ (search "deet" → composition)' : '\nFAIL ❌');
process.exit(ok ? 0 : 1);
