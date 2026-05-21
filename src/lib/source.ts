// Resolves a user-pasted URL (direct SDS PDF, or a product page that links to
// one) into PDF bytes. Cross-origin fetches go through a public CORS proxy as
// a Phase-1 stopgap; swap PROXY for your own Supabase/Render endpoint later.
const PROXY = (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;

const looksLikePdf = (url: string) => /\.pdf(?:[?#]|$)/i.test(url);
const isHomeDepot = (url: string) => /homedepot\.com|thdstatic\.com/i.test(url);

function isPdfBytes(buf: ArrayBuffer): boolean {
  const head = new TextDecoder('ascii').decode(new Uint8Array(buf.slice(0, 5)));
  return head.startsWith('%PDF');
}

/** Detect a bot-protection / error page returned in place of real content. */
function looksBlocked(buf: ArrayBuffer): boolean {
  const head = new TextDecoder('utf-8').decode(new Uint8Array(buf.slice(0, 600))).toLowerCase();
  return /service unavailable|access denied|edgesuite|akamai|captcha|reference&#35;|<html/.test(head);
}

function blockedError(url: string): Error {
  return new Error(
    isHomeDepot(url)
      ? 'Home Depot blocks automated downloads (Akamai bot protection). Open the SDS, download the PDF, and upload it above.'
      : 'That host blocked the fetch or returned a non-PDF page. Try the direct PDF link, or download and upload it.',
  );
}

/** Fetch a resource, trying direct first (works for CORS-permissive hosts),
 *  then falling back to the proxy. Returns the chosen Response. */
async function fetchAny(url: string): Promise<Response> {
  try {
    const direct = await fetch(url);
    if (direct.ok) return direct;
  } catch {
    /* CORS / network — fall through to proxy */
  }
  const viaProxy = await fetch(PROXY(url));
  if (!viaProxy.ok) throw new Error(`proxy returned HTTP ${viaProxy.status}`);
  return viaProxy;
}

/** Scan page HTML for the most likely SDS PDF link. */
export function findSdsLink(html: string, baseUrl: string): string | null {
  const urls = new Set<string>();

  const abs = /https?:\/\/[^\s"'<>()]+?\.pdf(?:\?[^\s"'<>()]*)?/gi;
  for (let m; (m = abs.exec(html)); ) urls.add(m[0]);

  const rel = /(?:href|src|data-[\w-]+)\s*=\s*["']([^"']+?\.pdf[^"']*)["']/gi;
  for (let m; (m = rel.exec(html)); ) {
    try { urls.add(new URL(m[1], baseUrl).href); } catch { /* skip bad URL */ }
  }

  const list = [...urls];
  if (list.length === 0) return null;

  const score = (u: string) =>
    (/sds|safety|msds/i.test(u) ? 3 : 0) +
    (/thdstatic\.com/i.test(u) ? 2 : 0) +
    (/pdfimages/i.test(u) ? 2 : 0);

  return list.sort((a, b) => score(b) - score(a))[0];
}

export interface ResolvedPdf {
  bytes: ArrayBuffer;
  sourceUrl: string;
  /** True when we had to dig the PDF link out of an HTML page. */
  fromPage: boolean;
}

/** Turn any pasted URL into SDS PDF bytes. */
export async function resolveToPdf(input: string): Promise<ResolvedPdf> {
  const url = input.trim();

  if (looksLikePdf(url)) {
    const bytes = await (await fetchAny(url)).arrayBuffer();
    if (!isPdfBytes(bytes)) throw blockedError(url);
    return { bytes, sourceUrl: url, fromPage: false };
  }

  // Treat as a web page: fetch HTML, find an SDS PDF link, then fetch it.
  const pageBytes = await (await fetchAny(url)).arrayBuffer();
  const html = new TextDecoder('utf-8').decode(new Uint8Array(pageBytes));
  if (looksBlocked(pageBytes) && isHomeDepot(url) && !findSdsLink(html, url)) {
    throw blockedError(url);
  }
  const pdfUrl = findSdsLink(html, url);
  if (!pdfUrl) {
    throw new Error('Couldn’t find an SDS PDF link on that page. Paste the direct PDF link instead.');
  }
  const bytes = await (await fetchAny(pdfUrl)).arrayBuffer();
  if (!isPdfBytes(bytes)) throw blockedError(pdfUrl);
  return { bytes, sourceUrl: pdfUrl, fromPage: true };
}
