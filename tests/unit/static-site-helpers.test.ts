import { describe, it, expect } from 'vitest';
import { injectBaseHref, mimeForPath } from '../../apps/web/lib/r2/static-site';

describe('injectBaseHref', () => {
  it('inserts a <base> immediately after <head>', () => {
    const out = injectBaseHref('<html><head><title>x</title></head><body></body></html>', 'demo');
    expect(out).toContain('<base href="/h/demo/">');
    // base must precede the title so relative refs in <head> resolve too
    expect(out.indexOf('<base')).toBeLessThan(out.indexOf('<title>'));
  });

  it('preserves attributes on the <head> tag', () => {
    const out = injectBaseHref('<head data-x="1">', 'demo');
    expect(out).toContain('<head data-x="1">');
    expect(out).toContain('<base href="/h/demo/">');
  });

  it('is idempotent — never adds a second <base>', () => {
    const once = injectBaseHref('<html><head></head></html>', 'demo');
    const twice = injectBaseHref(once, 'demo');
    expect(twice.match(/<base /g)?.length).toBe(1);
  });

  it('synthesizes a <head> when the document lacks one', () => {
    const out = injectBaseHref('<html><body>hi</body></html>', 'demo');
    expect(out).toContain('<base href="/h/demo/">');
  });

  it('falls back to prepending when there is no <html> or <head>', () => {
    const out = injectBaseHref('<body>hi</body>', 'demo');
    expect(out.startsWith('<base href="/h/demo/">')).toBe(true);
  });
});

describe('mimeForPath', () => {
  it('maps common asset extensions', () => {
    expect(mimeForPath('index.html')).toBe('text/html; charset=utf-8');
    expect(mimeForPath('assets/app.css')).toBe('text/css; charset=utf-8');
    expect(mimeForPath('assets/hero.jpg')).toBe('image/jpeg');
    expect(mimeForPath('a/b/logo.svg')).toBe('image/svg+xml');
    expect(mimeForPath('font.woff2')).toBe('font/woff2');
  });

  it('is case-insensitive on the extension', () => {
    expect(mimeForPath('PHOTO.JPG')).toBe('image/jpeg');
  });

  it('falls back to octet-stream for unknown/extensionless paths', () => {
    expect(mimeForPath('weird.xyz')).toBe('application/octet-stream');
    expect(mimeForPath('noext')).toBe('application/octet-stream');
  });
});
