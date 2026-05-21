import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:4321/chemicals/', { waitUntil: 'networkidle' });
await page.screenshot({ path: join(here, 'shot-empty.png') });
await page.setInputFiles('#file-input', join(here, 'sample-sds.pdf'));
await page.waitForSelector('#results:not(.hidden)');
await page.waitForTimeout(1200); // let bar/rows animate in
await page.screenshot({ path: join(here, 'shot-results.png'), fullPage: true });
await browser.close();
console.log('shots written');
