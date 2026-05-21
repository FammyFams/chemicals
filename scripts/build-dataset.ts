// Local "scraper": builds src/data/products.json from SDS PDFs you collect.
// Inputs (either/both):
//   scripts/sources.json  -> [{ "name", "brand"?, "url" }]  (PDF fetched locally)
//   scripts/pdfs/*.pdf     -> filename becomes the product name
// PDF CDN fetches work from your residential IP; HD product pages do not (Akamai).
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractLinesNode } from './pdf-node';
import { parseSds } from '../src/lib/sds';
import type { Ingredient } from '../src/lib/types';

interface Product {
  name: string;
  slug: string;
  brand?: string;
  aliases?: string[];
  sourceUrl?: string;
  found: boolean;
  ingredients: Ingredient[];
}

const here = dirname(fileURLToPath(import.meta.url));
const sourcesPath = join(here, 'sources.json');
const pdfsDir = join(here, 'pdfs');
const outDir = join(here, '..', 'src', 'data');
const outPath = join(outDir, 'products.json');

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function build(name: string, bytes: Uint8Array, extra: Partial<Product>): Promise<Product> {
  const comp = parseSds(await extractLinesNode(bytes));
  return { name, slug: slugify(name), found: comp.found, ingredients: comp.ingredients, ...extra };
}

const products: Product[] = [];

if (existsSync(sourcesPath)) {
  const sources: { name: string; brand?: string; aliases?: string[]; url: string }[] = JSON.parse(
    readFileSync(sourcesPath, 'utf8'),
  );
  for (const s of sources) {
    try {
      const res = await fetch(s.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      products.push(await build(s.name, bytes, { brand: s.brand, aliases: s.aliases, sourceUrl: s.url }));
      console.log('  ✓ url ', s.name);
    } catch (e) {
      console.log('  ✗ url ', s.name, '-', (e as Error).message);
    }
  }
}

if (existsSync(pdfsDir)) {
  for (const f of readdirSync(pdfsDir).filter((f) => /\.pdf$/i.test(f))) {
    try {
      const bytes = new Uint8Array(readFileSync(join(pdfsDir, f)));
      products.push(await build(basename(f).replace(/\.pdf$/i, ''), bytes, {}));
      console.log('  ✓ file', f);
    } catch (e) {
      console.log('  ✗ file', f, '-', (e as Error).message);
    }
  }
}

products.sort((a, b) => a.name.localeCompare(b.name));
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(products, null, 2));
console.log(`\nwrote ${products.length} product(s) -> ${outPath}`);
