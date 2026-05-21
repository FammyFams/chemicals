import { resolveToPdf, findSdsLink } from '../src/lib/source';

// 1) findSdsLink picks the best candidate out of page HTML.
const html = `
  <a href="/some/brochure.pdf">Brochure</a>
  <a href="https://images.thdstatic.com/catalog/pdfImages/f6/abc-safety-data-sheet.pdf">SDS</a>
  <link rel="stylesheet" href="/x.css">
`;
const picked = findSdsLink(html, 'https://www.homedepot.com/p/thing/123');
console.log('findSdsLink ->', picked);
console.log('  expected the thdstatic SDS pdf:', /thdstatic.*sds|safety/i.test(picked ?? '') ? 'OK' : 'WRONG');

// 2) resolveToPdf on a real direct PDF link (routes via proxy if CORS-blocked).
const directPdf =
  'https://images.thdstatic.com/catalog/pdfImages/f6/f673e668-e65c-4997-bf7e-8138f67f37a8.pdf';
try {
  const { bytes, sourceUrl, fromPage } = await resolveToPdf(directPdf);
  const head = new TextDecoder('ascii').decode(new Uint8Array(bytes.slice(0, 5)));
  console.log(`\nresolveToPdf(direct) -> ${bytes.byteLength} bytes, head="${head}", fromPage=${fromPage}`);
  console.log('  source:', sourceUrl);
} catch (e) {
  console.log('\nresolveToPdf(direct) FAILED:', (e as Error).message);
}
