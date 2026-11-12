import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';

// Renders a long-form application submission (e.g. a driver application) to a
// paginated PDF. Used by /api/application, which emails the PDF to the client
// owner — applications are too large / structured for the lead-email path
// (/api/contact caps message at 2000 chars and doesn't persist).

export interface AppField {
  q: string;
  a: string;
}

export interface AppPdfInput {
  businessName: string;
  kind: string; // e.g. "Driver Application" or "... — Pharmaceutical Team (Referral)"
  submittedAt: string; // human-readable string
  applicant: { name: string; email?: string; phone?: string };
  referralCode?: string;
  fields: AppField[];
}

// pdf-lib's StandardFonts use WinAnsi encoding, which throws on characters it
// can't encode (emoji, non-Latin, the undefined 0x80–0x9F slots). Normalize
// common smart punctuation to ASCII and drop anything unencodable so a stray
// character in user input can never crash the render.
function san(s: string): string {
  return String(s)
    .replace(/\t/g, ' ')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

export async function renderApplicationPdf(input: AppPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 612;
  const PAGE_H = 792;
  const M = 50;
  const CONTENT_W = PAGE_W - M * 2;
  const ink = rgb(0.09, 0.098, 0.11);
  const muted = rgb(0.35, 0.38, 0.41);
  const gold = rgb(0.894, 0.655, 0.169);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - M;
  };

  const wrap = (text: string, f: PDFFont, size: number, maxW: number): string[] => {
    const out: string[] = [];
    const paras = String(text).replace(/\r/g, '').split('\n');
    for (const p0 of paras) {
      const para = san(p0);
      if (para === '') {
        out.push('');
        continue;
      }
      const words = para.split(/\s+/).filter(Boolean);
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (f.widthOfTextAtSize(test, size) > maxW && line) {
          out.push(line);
          line = w;
        } else {
          line = test;
        }
        // Hard-break a single token longer than the content width.
        while (f.widthOfTextAtSize(line, size) > maxW && line.length > 1) {
          let cut = line.length - 1;
          while (cut > 1 && f.widthOfTextAtSize(line.slice(0, cut), size) > maxW) cut--;
          out.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      }
      out.push(line);
    }
    return out;
  };

  const draw = (lines: string[], f: PDFFont, size: number, color: ReturnType<typeof rgb>, lh: number) => {
    for (const ln of lines) {
      if (y - lh < M) newPage();
      if (ln) page.drawText(ln, { x: M, y: y - size, size, font: f, color });
      y -= lh;
    }
  };

  // Header
  draw(wrap(input.businessName, bold, 18, CONTENT_W), bold, 18, ink, 22);
  y -= 2;
  draw(wrap(input.kind, bold, 13, CONTENT_W), bold, 13, gold, 17);
  draw(wrap('Submitted: ' + input.submittedAt, font, 10, CONTENT_W), font, 10, muted, 14);
  y -= 6;
  if (y - 6 < M) newPage();
  page.drawRectangle({ x: M, y: y - 2, width: CONTENT_W, height: 1.4, color: gold });
  y -= 16;

  // Applicant summary
  const summary = [`Applicant: ${input.applicant.name}`];
  if (input.applicant.email) summary.push(`Email: ${input.applicant.email}`);
  if (input.applicant.phone) summary.push(`Phone: ${input.applicant.phone}`);
  if (input.referralCode) summary.push(`Referral code: ${input.referralCode}`);
  for (const s of summary) draw(wrap(s, font, 11, CONTENT_W), font, 11, ink, 15);
  y -= 12;

  // Q&A
  for (const fld of input.fields) {
    if (y - 40 < M) newPage();
    draw(wrap(fld.q, bold, 10.5, CONTENT_W), bold, 10.5, muted, 14);
    draw(wrap(fld.a && fld.a.trim() ? fld.a : '—', font, 11, CONTENT_W), font, 11, ink, 15);
    y -= 8;
  }

  return doc.save();
}
