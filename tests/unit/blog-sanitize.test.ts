import { describe, it, expect } from 'vitest';
import { sanitizePostHtml, slugify } from '../../apps/web/lib/blog/sanitize';

const HOST = 'gopourmobile.com';
const a = (href: string) => `<p><a href="${href}">x</a></p>`;

describe('sanitizePostHtml — internal vs external links', () => {
  it('does not nofollow relative links, even with no host known', () => {
    for (const href of ['/', '/#contact', '/blog/some-post', '#faq', './x', '../y']) {
      const out = sanitizePostHtml(a(href));
      expect(out, href).not.toContain('nofollow');
      expect(out, href).not.toContain('target=');
      expect(out, href).toContain(`href="${href}"`);
    }
  });

  it('treats an absolute self-link as internal when the host is known', () => {
    for (const href of [`https://${HOST}/`, `https://www.${HOST}/#contact`, `http://${HOST}/blog/p`]) {
      const out = sanitizePostHtml(a(href), HOST);
      expect(out, href).not.toContain('nofollow');
      expect(out, href).not.toContain('target=');
    }
  });

  it('nofollows an absolute self-link when no host is supplied', () => {
    expect(sanitizePostHtml(a(`https://${HOST}/`))).toContain('nofollow');
  });

  it('still nofollows and _blanks genuinely external links', () => {
    const out = sanitizePostHtml(a('https://example.com/page'), HOST);
    expect(out).toContain('rel="noopener noreferrer nofollow ugc"');
    expect(out).toContain('target="_blank"');
  });

  it('treats protocol-relative and lookalike hosts as external', () => {
    for (const href of ['//evil.com', 'https://gopourmobile.com.evil.com/', 'https://notgopourmobile.com/']) {
      expect(sanitizePostHtml(a(href), HOST), href).toContain('nofollow');
    }
  });

  it('strips a pasted nofollow/target off an internal link', () => {
    const out = sanitizePostHtml('<p><a href="/" rel="nofollow" target="_blank">x</a></p>');
    expect(out).not.toContain('nofollow');
    expect(out).not.toContain('target=');
  });

  it('keeps the security boundary intact', () => {
    expect(sanitizePostHtml('<script>alert(1)</script><p>ok</p>')).toBe('<p>ok</p>');
    expect(sanitizePostHtml('<p><a href="javascript:alert(1)">x</a></p>')).not.toContain('javascript:');
    expect(sanitizePostHtml('<h1>no</h1><h2>yes</h2>')).toBe('no<h2>yes</h2>');
    expect(sanitizePostHtml('<p onclick="x()">t</p>')).toBe('<p>t</p>');
    expect(sanitizePostHtml('<table><tr><td>t</td></tr></table>')).not.toContain('<table');
  });
});

describe('slugify', () => {
  it('produces url-safe slugs', () => {
    expect(slugify('What Does a Mobile Bar Actually Cost?')).toBe('what-does-a-mobile-bar-actually-cost');
    expect(slugify('')).toBe('post');
    expect(slugify('  --Hello   World--  ')).toBe('hello-world');
  });
});
