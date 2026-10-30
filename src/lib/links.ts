// Pull result links out of a search-engine HTML page. Runs in the renderer (DOMParser),
// never injects fetched HTML into the document.

export interface Link {
  title: string;
  href: string;
}

function unwrap(href: string): string {
  // Ahmia wraps results: /search/redirect?search_term=..&redirect_url=<real>
  try {
    const u = new URL(href, 'http://x.invalid');
    const real = u.searchParams.get('redirect_url') ?? u.searchParams.get('uddg'); // uddg = DDG HTML
    if (real) return real;
  } catch { /* fall through */ }
  return href;
}

export function extractLinks(html: string, max = 40): Link[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const seen = new Set<string>();
  const out: Link[] = [];

  for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
    const href = unwrap(a.getAttribute('href') || '');
    let u: URL;
    try { u = new URL(href.startsWith('//') ? `https:${href}` : href); } catch { continue; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
    // drop the search engine's own navigation
    if (/(^|\.)(ahmia\.fi|duckduckgo\.com)$/.test(u.hostname)) continue;
    if (u.hostname.endsWith('.onion') && /^juhanurmihx/.test(u.hostname) && /\/search\/?$/.test(u.pathname)) continue;

    const key = u.origin + u.pathname;
    if (seen.has(key)) continue;
    seen.add(key);

    const title = (a.textContent || '').replace(/\s+/g, ' ').trim() || u.hostname;
    out.push({ title: title.slice(0, 120), href: u.toString() });
    if (out.length >= max) break;
  }
  return out;
}
