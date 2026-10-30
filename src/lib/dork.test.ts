import { describe, it, expect } from 'vitest';
import { buildDork, normalizeDomain, makeEngines, TEMPLATES } from './dork';

describe('dork builder', () => {
  it('builds operators and quotes values with spaces', () => {
    expect(buildDork([
      { op: 'site', value: 'example.com' },
      { op: 'intitle', value: 'index of' },
      { op: 'filetype', value: 'pdf', negate: true }
    ])).toBe('site:example.com intitle:"index of" -filetype:pdf');
  });

  it('does not double-quote, strips injected quotes, skips empties', () => {
    expect(buildDork([
      { op: 'intext', value: '"already quoted"' },
      { op: 'intext', value: 'a "b" c' },
      { op: 'site', value: '   ' }
    ])).toBe('intext:"already quoted" intext:"a b c"');
  });

  it('raw clauses pass through unprefixed', () => {
    expect(buildDork([{ op: 'raw', value: '(a OR b)' }])).toBe('(a OR b)');
  });
});

describe('normalizeDomain', () => {
  it('cleans urls', () => {
    expect(normalizeDomain('https://Sub.Example.com/path?x=1')).toBe('sub.example.com');
  });
  it('rejects junk and injection', () => {
    expect(normalizeDomain('exa mple.com')).toBeNull();
    expect(normalizeDomain('example.com OR site:evil.com')).toBeNull();
    expect(normalizeDomain('localhost')).toBeNull();
  });
  it('accepts v3 onion hosts only when well-formed', () => {
    expect(normalizeDomain('juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion')).not.toBeNull();
    expect(normalizeDomain('short.onion')).toBeNull();
  });
});

describe('engines and templates', () => {
  const engines = makeEngines();
  it('url-encodes the query', () => {
    const g = engines.find(e => e.id === 'google')!;
    expect(g.url('site:a.com "x y"')).toBe('https://www.google.com/search?q=site%3Aa.com%20%22x%20y%22');
  });
  it('tor engines are routed through tor, never external', () => {
    expect(engines.filter(e => e.id.includes('tor')).every(e => e.route === 'tor')).toBe(true);
  });
  it('every template produces a non-empty query', () => {
    for (const t of TEMPLATES) expect(buildDork(t.build('example.com'))).not.toBe('');
  });
});
