// YappinaTor: search-operator (dork) builder + engine routing.
// Pure functions only. Network goes through the Electron main process (see tor:fetch).

export type Op =
  | 'site' | 'filetype' | 'ext' | 'intitle' | 'inurl' | 'intext'
  | 'inanchor' | 'allintitle' | 'before' | 'after' | 'raw';

export interface Clause {
  op: Op;
  value: string;
  negate?: boolean;
}

const needsQuote = (v: string) => /\s/.test(v) && !/^".*"$/.test(v);
const q = (v: string) => (needsQuote(v) ? `"${v.replace(/"/g, '')}"` : v);

export function buildDork(clauses: Clause[]): string {
  return clauses
    .filter(c => c.value.trim())
    .map(c => {
      const v = c.value.trim();
      const body = c.op === 'raw' ? v : `${c.op}:${q(v)}`;
      return c.negate ? `-${body}` : body;
    })
    .join(' ');
}

// Accepts example.com, https://example.com/path, sub.example.com. Rejects junk.
export function normalizeDomain(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '');
  if (s.endsWith('.onion')) return /^[a-z2-7]{16,56}\.onion$/.test(s) ? s : null;
  return /^(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,}$/.test(s) ? s : null;
}

export type Route = 'external' | 'tor';

export interface Engine {
  id: string;
  name: string;
  route: Route; // external = opens in system browser, tor = fetched via local Tor SOCKS5
  url: (query: string) => string;
}

const enc = encodeURIComponent;

// Ahmia's v3 onion address is configurable in the UI: indexes rotate and mirrors die.
export const DEFAULT_AHMIA_ONION =
  'juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion';

export function makeEngines(ahmiaOnion = DEFAULT_AHMIA_ONION): Engine[] {
  return [
    { id: 'google', name: 'Google', route: 'external', url: s => `https://www.google.com/search?q=${enc(s)}` },
    { id: 'ddg', name: 'DuckDuckGo', route: 'external', url: s => `https://duckduckgo.com/?q=${enc(s)}` },
    { id: 'bing', name: 'Bing', route: 'external', url: s => `https://www.bing.com/search?q=${enc(s)}` },
    { id: 'brave', name: 'Brave', route: 'external', url: s => `https://search.brave.com/search?q=${enc(s)}` },
    { id: 'ahmia-tor', name: 'Ahmia (.onion via Tor)', route: 'tor', url: s => `http://${ahmiaOnion}/search/?q=${enc(s)}` },
    { id: 'ahmia-clear-tor', name: 'Ahmia (clearnet via Tor)', route: 'tor', url: s => `https://ahmia.fi/search/?q=${enc(s)}` },
    { id: 'ddg-tor', name: 'DuckDuckGo HTML (via Tor)', route: 'tor', url: s => `https://html.duckduckgo.com/html/?q=${enc(s)}` }
  ];
}

export interface Template {
  id: string;
  label: string;
  needsTarget: boolean;
  build: (target: string) => Clause[];
}

// Templates only BUILD a query string. Nothing is fetched or scored automatically.
export const TEMPLATES: Template[] = [
  { id: 'docs', label: 'Dokumenti na domenu', needsTarget: true,
    build: t => [{ op: 'site', value: t }, { op: 'raw', value: '(filetype:pdf OR filetype:docx OR filetype:xlsx)' }] },
  { id: 'index', label: 'Otvoreni direktorijumi (index of)', needsTarget: true,
    build: t => [{ op: 'site', value: t }, { op: 'intitle', value: 'index of' }] },
  { id: 'audit-files', label: 'AUDIT sopstvenog domena: slučajno izložen config/log/backup', needsTarget: true,
    build: t => [{ op: 'site', value: t }, { op: 'raw', value: '(ext:env OR ext:log OR ext:bak OR ext:sql OR ext:conf)' }] },
  { id: 'login', label: 'Login / admin paneli na domenu', needsTarget: true,
    build: t => [{ op: 'site', value: t }, { op: 'raw', value: '(inurl:login OR inurl:admin OR intitle:"sign in")' }] },
  { id: 'subs', label: 'Subdomeni (bez www)', needsTarget: true,
    build: t => [{ op: 'site', value: `*.${t}` }, { op: 'site', value: `www.${t}`, negate: true }] },
  { id: 'pdf-topic', label: 'PDF o temi', needsTarget: false,
    build: () => [{ op: 'filetype', value: 'pdf' }] },
  { id: 'onion-dir', label: 'Onion direktorijumi / liste', needsTarget: false,
    build: () => [{ op: 'raw', value: 'onion directory OR "hidden wiki" OR "onion links"' }] }
];
