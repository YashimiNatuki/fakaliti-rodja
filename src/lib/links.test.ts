// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { extractLinks } from './links';

describe('extractLinks', () => {
  it('unwraps ahmia redirects, dedupes, drops non-http schemes', () => {
    const html = `
      <a href="/search/redirect?search_term=x&redirect_url=http%3A%2F%2Fabcdefghijklmnop.onion%2Fpage">Hidden thing</a>
      <a href="http://abcdefghijklmnop.onion/page">dupe</a>
      <a href="javascript:alert(1)">xss</a>
      <a href="file:///etc/passwd">file</a>
      <a href="https://example.org/a">Example</a>`;
    const r = extractLinks(html);
    expect(r.map(l => l.href)).toEqual([
      'http://abcdefghijklmnop.onion/page',
      'https://example.org/a'
    ]);
    expect(r[0].title).toBe('Hidden thing');
  });

  it('unwraps DDG html redirects (uddg)', () => {
    const r = extractLinks('<a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fz">Z</a>');
    expect(r[0].href).toBe('https://example.com/z');
  });
});
