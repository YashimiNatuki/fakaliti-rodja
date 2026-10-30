import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Notes can hold pasted web content. Sanitize always, and drop anything that makes the
// renderer fetch a remote resource (img/video/...): a remote <img> is a tracking pixel
// that leaks "this note was opened" + your IP.
export function renderMd(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_ATTR: ['style', 'srcset', 'src'],
    FORBID_TAGS: ['style', 'form', 'input', 'img', 'picture', 'source', 'video', 'audio', 'iframe', 'object', 'embed', 'link']
  });
}
