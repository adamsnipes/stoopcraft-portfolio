// Renders a SeoReport into the {{{html}}} blocks the seo_report template slots in.
//
// Email-client constraints drive every choice here: Gmail strips <style> blocks
// and SVG entirely, so this is all inline styles and nested tables, and the
// trend chart is drawn with background-coloured table cells rather than an
// image or a chart library. Nothing loads from the network — no tracking pixel
// dependency, no broken-image placeholders behind an image blocker.

import { escapeHtml } from '@/lib/email/templates';
import type { Metric, PageRow, QueryRow, SeoReport } from './report';

const INK = '#18181b';
const MUTED = '#71717a';
const BORDER = '#e4e4e7';
const TRACK = '#f4f4f5';
const UP = '#15803d';
const DOWN = '#b91c1c';

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function num(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

function pos(p: number): string {
  return p ? p.toFixed(1) : '—';
}

/** Coloured ▲/▼ chip. `higherIsBetter` flips the colour for metrics like
 *  average position, where a smaller number is the good outcome. */
function chip(value: number | null, opts: { suffix?: string; higherIsBetter?: boolean } = {}): string {
  if (value === null) {
    return `<span style="font-size:12px;color:${MUTED};">no prior data</span>`;
  }
  const { suffix = '%', higherIsBetter = true } = opts;
  const rounded = Math.abs(value) < 0.05 ? 0 : value;
  if (rounded === 0) {
    return `<span style="font-size:12px;color:${MUTED};">no change</span>`;
  }
  const good = higherIsBetter ? rounded > 0 : rounded < 0;
  const arrow = rounded > 0 ? '&#9650;' : '&#9660;';
  const magnitude = suffix === '%' ? Math.abs(rounded).toFixed(0) : Math.abs(rounded).toFixed(1);
  return `<span style="font-size:12px;color:${good ? UP : DOWN};font-weight:600;">${arrow} ${magnitude}${suffix}</span>`;
}

function statCell(label: string, value: string, delta: string): string {
  return `<td width="50%" style="padding:14px 16px;border:1px solid ${BORDER};border-radius:8px;background-color:#ffffff;" valign="top">
    <div style="font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:0.06em;">${label}</div>
    <div style="font-size:26px;font-weight:600;color:${INK};line-height:1.2;margin:4px 0 2px 0;">${value}</div>
    <div>${delta}</div>
  </td>`;
}

function sectionHeading(title: string, blurb?: string): string {
  return `<h2 style="margin:32px 0 ${blurb ? '4px' : '12px'} 0;font-size:16px;font-weight:600;color:${INK};">${title}</h2>${
    blurb ? `<p style="margin:0 0 12px 0;font-size:13px;color:${MUTED};line-height:1.5;">${blurb}</p>` : ''
  }`;
}

/** Zebra-free bordered table wrapper — borders read more reliably than
 *  background stripes across Outlook and dark-mode Gmail. */
function tableShell(headerCells: string, bodyRows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid ${BORDER};border-radius:8px;overflow:hidden;font-size:14px;">
    <tr style="background-color:#fafafa;">${headerCells}</tr>
    ${bodyRows}
  </table>`;
}

function th(label: string, align: 'left' | 'right' = 'left'): string {
  return `<td align="${align}" style="padding:10px 14px;font-size:12px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid ${BORDER};">${label}</td>`;
}

function td(content: string, align: 'left' | 'right' = 'left', last = false): string {
  return `<td align="${align}" style="padding:11px 14px;color:${INK};${last ? '' : `border-bottom:1px solid ${BORDER};`}">${content}</td>`;
}

/** Strips scheme + host so a client sees "/catering", not the full URL. */
function pagePath(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname === '/' ? 'Homepage' : pathname;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function summarySection(totals: Metric, change: SeoReport['change'], days: number): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="6" border="0" style="width:100%;border-collapse:separate;">
    <tr>
      ${statCell('Clicks', num(totals.clicks), chip(change.clicksPct))}
      ${statCell('Impressions', num(totals.impressions), chip(change.impressionsPct))}
    </tr>
    <tr>
      ${statCell('Avg. position', pos(totals.position), chip(change.position, { suffix: '', higherIsBetter: true }))}
      ${statCell('Click rate', pct(totals.ctr), chip(change.ctrPct))}
    </tr>
  </table>
  <p style="margin:12px 0 0 0;font-size:13px;color:${MUTED};line-height:1.5;">
    <strong style="color:${INK};">Impressions</strong> are how many times you appeared in Google results.
    <strong style="color:${INK};">Clicks</strong> are how many people chose your site.
    <strong style="color:${INK};">Average position</strong> is where you sit on the results page — lower is better, and 1–10 is page one.
    Every change is measured against the previous ${days} days.
  </p>`;
}

function trendSection(monthly: SeoReport['monthly']): string {
  if (monthly.length < 2) return '';

  const max = Math.max(...monthly.map((m) => m.impressions), 1);

  const rows = monthly
    .map((m) => {
      const width = Math.max(m.impressions > 0 ? 2 : 0, Math.round((m.impressions / max) * 100));
      // Track cell holds a filled cell + a remainder cell. font-size:0 keeps
      // Outlook from padding the bar to a text line-height.
      const bar =
        width === 0
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${TRACK};border-radius:4px;"><tr><td style="font-size:0;line-height:8px;height:8px;">&nbsp;</td></tr></table>`
          : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${TRACK};border-radius:4px;"><tr>
              <td width="${width}%" style="background-color:${INK};border-radius:4px;font-size:0;line-height:8px;height:8px;">&nbsp;</td>
              ${width < 100 ? `<td style="font-size:0;line-height:8px;height:8px;">&nbsp;</td>` : ''}
            </tr></table>`;

      return `<tr>
        <td width="44" valign="middle" style="padding:7px 10px 7px 0;font-size:13px;color:${MUTED};white-space:nowrap;">${escapeHtml(m.label)}</td>
        <td valign="middle" style="padding:7px 0;">${bar}</td>
        <td valign="middle" align="right" style="padding:7px 0 7px 12px;font-size:13px;color:${INK};white-space:nowrap;">
          <strong>${num(m.impressions)}</strong> <span style="color:${MUTED};">seen</span>
          <span style="color:${BORDER};">|</span> <strong>${num(m.clicks)}</strong> <span style="color:${MUTED};">clicks</span>
        </td>
      </tr>`;
    })
    .join('');

  return `${sectionHeading('Month by month')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
}

function funnelSection(funnel: NonNullable<SeoReport['funnel']>, totals: Metric): string {
  const steps: [string, number][] = [
    ['Seen on Google', totals.impressions],
    ['Clicked through', totals.clicks],
    ['Pages viewed on your site', funnel.pageViews],
    ['Tapped to contact you', funnel.contactClicks + funnel.bookingClicks],
  ];

  const rows = steps
    .map(([label, value], i) =>
      `<tr>
        ${td(`<span style="color:${MUTED};">${i + 1}.</span> ${escapeHtml(label)}`, 'left', i === steps.length - 1)}
        ${td(`<strong>${num(value)}</strong>`, 'right', i === steps.length - 1)}
      </tr>`,
    )
    .join('');

  return `${sectionHeading(
    'From search to phone call',
    'The whole path, end to end — most reports stop at the click.',
  )}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid ${BORDER};border-radius:8px;overflow:hidden;font-size:14px;">${rows}</table>`;
}

function queryRows(rows: QueryRow[], showChange: boolean): string {
  return rows
    .map((q, i) => {
      const last = i === rows.length - 1;
      const movement = q.isNew
        ? `<span style="font-size:12px;color:${UP};font-weight:600;">new</span>`
        : chip(q.positionChange, { suffix: '', higherIsBetter: true });
      return `<tr>
        ${td(escapeHtml(q.query), 'left', last)}
        ${td(num(q.clicks), 'right', last)}
        ${td(`${pos(q.position)}${showChange ? ` <span style="white-space:nowrap;">${movement}</span>` : ''}`, 'right', last)}
      </tr>`;
    })
    .join('');
}

function topQueriesSection(rows: QueryRow[], namedClicks: number, totalClicks: number): string {
  if (rows.length === 0) return '';

  // Google names only the searches enough different people used. Without this
  // note a client reads "412 clicks" up top and a column of zeros below it and
  // concludes the report is broken — which on a low-traffic site is the norm,
  // not the exception.
  const hidden = totalClicks - namedClicks;
  const note =
    hidden > 0
      ? `<p style="margin:10px 0 0 0;font-size:12px;color:${MUTED};line-height:1.5;">
          Google only names searches that enough different people used, so ${num(hidden)} of your
          ${num(totalClicks)} click${totalClicks === 1 ? '' : 's'} came from rarer searches it doesn't disclose.
          They still count in the totals above.
        </p>`
      : '';

  return `${sectionHeading('What people searched to find you')}
    ${tableShell(`${th('Search term')}${th('Clicks', 'right')}${th('Position', 'right')}`, queryRows(rows, true))}
    ${note}`;
}

function newQueriesSection(rows: QueryRow[]): string {
  if (rows.length === 0) return '';
  return `${sectionHeading(
    'New this period',
    "Searches you're showing up for now that you weren't before.",
  )}
    ${tableShell(`${th('Search term')}${th('Clicks', 'right')}${th('Position', 'right')}`, queryRows(rows, false))}`;
}

function strikingSection(rows: QueryRow[]): string {
  if (rows.length === 0) return '';
  return `${sectionHeading(
    'Almost on page one',
    'These sit at positions 11–20 — close enough that a bit of content work usually pushes them onto page one, where nearly all the clicks are.',
  )}
    ${tableShell(
      `${th('Search term')}${th('Times seen', 'right')}${th('Position', 'right')}`,
      rows
        .map((q, i) => {
          const last = i === rows.length - 1;
          return `<tr>
            ${td(escapeHtml(q.query), 'left', last)}
            ${td(num(q.impressions), 'right', last)}
            ${td(pos(q.position), 'right', last)}
          </tr>`;
        })
        .join(''),
    )}`;
}

function pagesSection(rows: PageRow[]): string {
  if (rows.length === 0) return '';
  return `${sectionHeading('Your best-performing pages')}
    ${tableShell(
      `${th('Page')}${th('Clicks', 'right')}${th('Times seen', 'right')}`,
      rows
        .map((p, i) => {
          const last = i === rows.length - 1;
          return `<tr>
            ${td(escapeHtml(pagePath(p.page)), 'left', last)}
            ${td(num(p.clicks), 'right', last)}
            ${td(num(p.impressions), 'right', last)}
          </tr>`;
        })
        .join(''),
    )}`;
}

// ---------------------------------------------------------------------------

/** Template variables for the `seo_report` email. All values are strings
 *  because EmailProvider.send only accepts Record<string, string>; the _html
 *  keys are consumed by triple-brace (unescaped) slots. */
export function seoReportVariables(report: SeoReport): Record<string, string> {
  const days = Math.round(
    (Date.parse(report.range.end) - Date.parse(report.range.start)) / 86_400_000,
  ) + 1;

  return {
    business_name: report.businessName,
    range_label: report.range.label,
    summary_html: summarySection(report.totals, report.change, days),
    trend_html: trendSection(report.monthly),
    funnel_html: report.funnel ? funnelSection(report.funnel, report.totals) : '',
    queries_html: topQueriesSection(report.topQueries, report.namedQueryClicks, report.totals.clicks),
    new_queries_html: newQueriesSection(report.newQueries),
    striking_html: strikingSection(report.strikingDistance),
    pages_html: pagesSection(report.topPages),
  };
}
