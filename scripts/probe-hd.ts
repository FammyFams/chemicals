// Feasibility probe: can a real local Chrome reach an HD product page and find
// its SDS link without getting Akamai-blocked? Run headed for best odds.
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const target = process.argv[2] ?? 'https://www.homedepot.com/s/repel%20sportsmen%20max';
console.log('navigating:', target);
await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => console.log('goto err', e.message));
await page.waitForTimeout(6000);

const title = await page.title();
const url = page.url();
console.log('landed title:', title);
console.log('landed url  :', url);

// Akamai block detection
const bodyText = (await page.textContent('body').catch(() => '')) ?? '';
const blocked = /access denied|reference #|are you a human|verify you are|unusual traffic|pardon our interruption/i.test(bodyText);
console.log('looks blocked:', blocked);

// Find any product links if this is a search page
const productLinks = await page.$$eval('a[href*="/p/"]', (as) =>
  [...new Set(as.map((a) => (a as HTMLAnchorElement).href))].slice(0, 5),
);
console.log('product links found:', productLinks);

// Find any pdf / SDS references in DOM + network
const pdfLinks = await page.$$eval('a[href*=".pdf"], a[href*="pdfImages"]', (as) =>
  [...new Set(as.map((a) => (a as HTMLAnchorElement).href))],
);
console.log('pdf links in DOM:', pdfLinks);

const sdsText = await page.$$eval('a, button', (els) =>
  els.filter((e) => /safety data sheet|sds/i.test(e.textContent ?? ''))
    .map((e) => (e.textContent ?? '').trim())
    .slice(0, 5),
);
console.log('elements mentioning SDS:', sdsText);

await page.screenshot({ path: new URL('./probe-hd.png', import.meta.url).pathname.replace(/^\//, '') }).catch(() => {});
await browser.close();
