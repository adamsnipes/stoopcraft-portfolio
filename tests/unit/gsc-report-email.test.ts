import { describe, it, expect } from 'vitest';
import { renderTemplate } from '../../apps/web/lib/email/templates';
import { seoReportVariables } from '../../apps/web/lib/gsc/email';
import type { SeoReport } from '../../apps/web/lib/gsc/report';

function report(overrides: Partial<SeoReport> = {}): SeoReport {
  return {
    clientId: 'c1',
    businessName: "JJ's Pie Co",
    property: 'sc-domain:jjspie.co',
    range: { start: '2026-05-12', end: '2026-08-08', label: 'May 12 – Aug 8, 2026' },
    previousRange: { start: '2026-02-11', end: '2026-05-11' },
    totals: { clicks: 412, impressions: 18240, ctr: 0.0226, position: 12.4 },
    previousTotals: { clicks: 330, impressions: 15100, ctr: 0.0219, position: 14.7 },
    change: { clicksPct: 24.8, impressionsPct: 20.8, ctrPct: 3.2, position: 2.3 },
    topQueries: [
      {
        query: 'pizza near me',
        clicks: 88,
        impressions: 2400,
        ctr: 0.036,
        position: 6.1,
        previousPosition: 9.4,
        positionChange: 3.3,
        isNew: false,
      },
    ],
    namedQueryClicks: 88,
    newQueries: [
      {
        query: 'gluten free pizza downtown',
        clicks: 12,
        impressions: 340,
        ctr: 0.035,
        position: 8.2,
        previousPosition: null,
        positionChange: null,
        isNew: true,
      },
    ],
    strikingDistance: [
      {
        query: 'best deep dish',
        clicks: 2,
        impressions: 900,
        ctr: 0.002,
        position: 13.6,
        previousPosition: 15.1,
        positionChange: 1.5,
        isNew: false,
      },
    ],
    topPages: [
      { page: 'https://jjspie.co/', clicks: 210, impressions: 9000, ctr: 0.023, position: 11.1 },
      { page: 'https://jjspie.co/catering', clicks: 64, impressions: 1800, ctr: 0.035, position: 9.8 },
    ],
    monthly: [
      { month: '2026-06', label: 'Jun', clicks: 120, impressions: 5200 },
      { month: '2026-07', label: 'Jul', clicks: 145, impressions: 6400 },
      { month: '2026-08', label: 'Aug', clicks: 147, impressions: 6640 },
    ],
    funnel: { pageViews: 260, contactClicks: 31, bookingClicks: 4 },
    ...overrides,
  };
}

describe('seoReportVariables', () => {
  it('renders every section when the report is complete', () => {
    const { html, subject } = renderTemplate('seo_report', seoReportVariables(report()));

    expect(subject).toBe("Google search report — JJ's Pie Co");
    expect(html).toContain('May 12 – Aug 8, 2026');
    expect(html).toContain('18,240'); // impressions, thousands-separated
    expect(html).toContain('12.4'); // avg position
    expect(html).toContain('2.3%'); // CTR as a percentage
    expect(html).toContain('What people searched to find you');
    expect(html).toContain('New this period');
    expect(html).toContain('Almost on page one');
    expect(html).toContain('Your best-performing pages');
    expect(html).toContain('From search to phone call');
    expect(html).toContain('Month by month');
  });

  it('compares against a window of the same length', () => {
    const { html } = renderTemplate('seo_report', seoReportVariables(report()));
    expect(html).toContain('the previous 89 days');
  });

  it('colours gains green and losses red', () => {
    const { html } = renderTemplate('seo_report', seoReportVariables(report()));
    expect(html).toContain('#15803d'); // clicks up

    const declining = renderTemplate(
      'seo_report',
      seoReportVariables(
        report({ change: { clicksPct: -31, impressionsPct: -12, ctrPct: -4, position: 2.3 } }),
      ),
    );
    expect(declining.html).toContain('#b91c1c');
  });

  it('treats a falling average position as an improvement', () => {
    // position change is stored as previous - current, so positive = moved up.
    const { html } = renderTemplate('seo_report', seoReportVariables(report()));
    const positionCell = html.slice(html.indexOf('Avg. position'), html.indexOf('Click rate'));
    expect(positionCell).toContain('#15803d');
    expect(positionCell).toContain('2.3');

    const worse = renderTemplate(
      'seo_report',
      seoReportVariables(report({ change: { clicksPct: 5, impressionsPct: 5, ctrPct: 0, position: -1.8 } })),
    );
    const worseCell = worse.html.slice(worse.html.indexOf('Avg. position'), worse.html.indexOf('Click rate'));
    expect(worseCell).toContain('#b91c1c');
  });

  it('drops sections that have no data rather than showing empty tables', () => {
    const { html } = renderTemplate(
      'seo_report',
      seoReportVariables(
        report({ newQueries: [], strikingDistance: [], topPages: [], funnel: null, monthly: [] }),
      ),
    );
    expect(html).not.toContain('New this period');
    expect(html).not.toContain('Almost on page one');
    expect(html).not.toContain('Your best-performing pages');
    expect(html).not.toContain('From search to phone call');
    expect(html).not.toContain('Month by month');
    // The parts that always have data survive.
    expect(html).toContain('What people searched to find you');
  });

  it('escapes search terms, which are arbitrary text people typed into Google', () => {
    const { html } = renderTemplate(
      'seo_report',
      seoReportVariables(
        report({
          topQueries: [
            {
              query: '<img src=x onerror=alert(1)>',
              clicks: 1,
              impressions: 10,
              ctr: 0.1,
              position: 5,
              previousPosition: null,
              positionChange: null,
              isNew: true,
            },
          ],
        }),
      ),
    );
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('explains the gap when Google withholds clicks from rare searches', () => {
    // gopourmobile's real shape: real clicks in the totals, zero at query level.
    const { html } = renderTemplate(
      'seo_report',
      seoReportVariables(
        report({
          totals: { clicks: 12, impressions: 204, ctr: 0.059, position: 27.8 },
          namedQueryClicks: 0,
        }),
      ),
    );
    expect(html).toContain("rarer searches it doesn't disclose");
    // Collapse the template literal's indentation — it's insignificant in HTML.
    expect(html.replace(/\s+/g, ' ')).toContain('12 of your 12 clicks');
  });

  it('omits the note when every click is accounted for', () => {
    const { html } = renderTemplate(
      'seo_report',
      seoReportVariables(report({ totals: { clicks: 88, impressions: 2400, ctr: 0.036, position: 6.1 } })),
    );
    expect(html).not.toContain("doesn't disclose");
  });

  it('shows page paths, not full URLs', () => {
    const { html } = renderTemplate('seo_report', seoReportVariables(report()));
    expect(html).toContain('Homepage');
    expect(html).toContain('/catering');
    expect(html).not.toContain('https://jjspie.co/catering');
  });

  it('never emits SVG or external references, which email clients strip or block', () => {
    const { html } = renderTemplate('seo_report', seoReportVariables(report()));
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<style');
  });
});
