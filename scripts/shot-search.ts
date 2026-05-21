import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:4321/chemicals/', { waitUntil: 'networkidle' });
await p.fill('#product-search', 'deet');
await p.waitForSelector('#search-results li');
await p.screenshot({ path: 'scripts/shot-search.png' });
await b.close(); console.log('ok');
