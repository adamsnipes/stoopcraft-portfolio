import { describe, it, expect } from 'vitest';
import { escapeHtml, renderTemplate } from '../../apps/web/lib/email/templates';

describe('escapeHtml', () => {
  it('escapes all five special characters', () => {
    expect(escapeHtml('& < > " \'')).toBe('&amp; &lt; &gt; &quot; &#39;');
  });

  it('passes through plain text unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });

  it('escapes multiple occurrences', () => {
    expect(escapeHtml('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
  });
});

describe('renderTemplate — HTML injection prevention', () => {
  it('escapes user-controlled business_name in welcome email', () => {
    const { html } = renderTemplate('welcome', {
      business_name: '<script>alert(1)</script>',
      site_url: 'https://example.com',
      portal_url: 'https://example.com/portal',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes user-controlled body in request_submitted email', () => {
    const { html } = renderTemplate('request_submitted', {
      business_name: 'Acme',
      body: '<img src=x onerror="fetch(\'https://evil.com\')">',
      portal_url: 'https://example.com/portal',
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('passes resolution_note_html through unescaped (triple-brace slot)', () => {
    const noteHtml = '<p><strong>Note from us:</strong> Looks great!</p>';
    const { html } = renderTemplate('request_status_updated', {
      business_name: 'Acme',
      body: 'Please update hours.',
      status_label: 'Done',
      resolution_note_html: noteHtml,
      portal_url: 'https://example.com/portal',
    });
    expect(html).toContain(noteHtml);
    expect(html).not.toContain('&lt;p&gt;');
  });

  it('escapes ampersands in business names', () => {
    const { html } = renderTemplate('welcome', {
      business_name: 'Smith & Sons',
      site_url: 'https://example.com',
      portal_url: 'https://example.com/portal',
    });
    expect(html).toContain('Smith &amp; Sons');
    expect(html).not.toContain('Smith & Sons');
  });
});

describe('renderTemplate — subject lines are plain text, not HTML', () => {
  // A subject is a mail header. Escaping it renders the entity literally in the
  // inbox ("JJ&#39;s Pie Co"), which every apostrophe/ampersand business name hits.
  it('leaves apostrophes and ampersands alone in the subject', () => {
    const { subject } = renderTemplate('welcome', {
      business_name: "JJ's Pie & Co",
      site_url: 'https://example.com',
      portal_url: 'https://example.com/portal',
    });
    expect(subject).toBe("Your JJ's Pie & Co site is live");
    expect(subject).not.toContain('&#39;');
    expect(subject).not.toContain('&amp;');
  });

  it('still escapes the same name in the HTML body', () => {
    const { html } = renderTemplate('welcome', {
      business_name: "JJ's Pie & Co",
      site_url: 'https://example.com',
      portal_url: 'https://example.com/portal',
    });
    expect(html).toContain('JJ&#39;s Pie &amp; Co');
  });

  it('strips newlines and control characters from subject variables', () => {
    const { subject } = renderTemplate('welcome', {
      business_name: 'Acme\r\nBcc: attacker@evil.com',
      site_url: 'https://example.com',
      portal_url: 'https://example.com/portal',
    });
    expect(subject).not.toContain('\n');
    expect(subject).not.toContain('\r');
    expect(subject).toBe('Your Acme Bcc: attacker@evil.com site is live');
  });

  it('keeps hyphens, which are legitimate in business names', () => {
    const { subject } = renderTemplate('welcome', {
      business_name: 'Thumbs-Up HLC',
      site_url: 'https://example.com',
      portal_url: 'https://example.com/portal',
    });
    expect(subject).toBe('Your Thumbs-Up HLC site is live');
  });
});
