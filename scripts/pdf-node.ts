// Node-side PDF text extraction (mirrors src/lib/pdf.ts, whose worker import is
// Vite-only). Used by the dataset builder and file-based test scripts.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
).href;

export async function extractLinesNode(data: Uint8Array): Promise<string[]> {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
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
