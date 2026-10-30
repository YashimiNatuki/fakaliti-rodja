// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderMd } from './md';

describe('renderMd', () => {
  it('renders markdown', () => {
    expect(renderMd('**bold** and `code`')).toContain('<strong>bold</strong>');
  });
  it('strips script and event handlers', () => {
    const h = renderMd('<script>alert(1)</script><a href="x" onclick="alert(1)">a</a>');
    expect(h).not.toMatch(/<script|onclick/i);
  });
  it('removes remote-fetching tags (tracking pixels)', () => {
    const h = renderMd('![x](http://evil.example/p.png) <img src="http://evil.example/t.gif"> <iframe src="http://evil.example"></iframe>');
    expect(h).not.toMatch(/<img|<iframe|evil\.example\/(p\.png|t\.gif)/i);
  });
  it('blocks javascript: urls', () => {
    expect(renderMd('[x](javascript:alert(1))')).not.toMatch(/javascript:/i);
  });
});
