import * as pdfjsLib from 'pdfjs-dist';
// Vite resolves this to a hashed URL for the worker bundle.
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/**
 * Extract the document as ordered text lines. pdf.js gives positioned text
 * fragments; we group fragments with a similar baseline (y) into one line and
 * sort them left-to-right (x) so tabular Section 3 rows stay on one line.
 */
export async function extractLines(data: ArrayBuffer): Promise<string[]> {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const lines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    const frags = content.items
      .filter((it): it is import('pdfjs-dist/types/src/display/api').TextItem => 'str' in it)
      .map((it) => ({ x: it.transform[4], y: it.transform[5], str: it.str }));

    // Group by rounded y (PDF y grows upward, so sort descending).
    const rows = new Map<number, { x: number; str: string }[]>();
    for (const f of frags) {
      const key = Math.round(f.y);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key)!.push({ x: f.x, str: f.str });
    }

    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      const line = rows
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((f) => f.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (line) lines.push(line);
    }
  }

  return lines;
}
