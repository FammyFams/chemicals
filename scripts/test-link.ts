// Browser test of the paste-a-link flow through the public CORS proxy.
// (A) a generic PDF should reach the parser via the proxy (proves transport).
// (B) a Home Depot link should surface the clear Akamai-block message.
import { chromium } from 'playwright';

const GENERIC_PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
const HD_PDF =
  'https://images.thdstatic.com/catalog/pdfImages/f6/f673e668-e65c-4997-bf7e-8138f67f37a8.pdf';

const browser = await chromium.launch({ channel: 'chrome' });
const errors: string[] = [];

async function run(url: string): Promise<string> {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:4321/chemicals/', { waitUntil: 'networkidle' });
  await page.fill('#pdf-url', url);
  await page.click('#load-url');
  // Wait until status stops saying "Resolving…"
  await page
    .waitForFunction(() => {
      const t = document.getElementById('status')?.textContent ?? '';
      return t && !/resolving|reading/i.test(t);
    }, { timeout: 60000 })
    .catch(() => {});
  const status = (await page.textContent('#status'))?.trim() ?? '';
  await page.close();
  return status;
}

const aStatus = await run(GENERIC_PDF);
console.log('[A generic PDF] status:', aStatus);
const bStatus = await run(HD_PDF);
console.log('[B home depot ] status:', bStatus);
await browser.close();

console.log('\npage errors:', errors.length ? errors : 'none');
// A: proxy delivered a real PDF -> parser ran (it's not an SDS, so "Section 3" message).
const aOk = /section 3|ingredient|parsed/i.test(aStatus);
// B: HD link -> clear bot-protection guidance.
const bOk = /home depot blocks/i.test(bStatus);
console.log('A (transport via proxy):', aOk ? 'OK' : 'FAIL');
console.log('B (HD clear message)  :', bOk ? 'OK' : 'FAIL');
console.log(aOk && bOk && errors.length === 0 ? '\nPASS ✅' : '\nFAIL ❌');
process.exit(aOk && bOk && errors.length === 0 ? 0 : 1);
