/**
 * @file Direct PDF download (no print dialog).
 * Draws the resume from DATA with jsPDF's text API → real, selectable text (ATS-safe).
 * Never rasterizes HTML (html2canvas/html2pdf produce image PDFs that ATS can't parse).
 */
import { formatRange } from './utils.js';

const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const MM = 72 / 25.4;
const MARGINS_MM = { narrow: 10, normal: 16, wide: 22 };
const SERIF = ['Merriweather', 'EB Garamond', 'Source Serif 4', 'Lora', 'Georgia', 'Times New Roman'];
const MONO = ['JetBrains Mono', 'IBM Plex Mono', 'Roboto Mono', 'Source Code Pro', 'Courier Prime'];

let jsPDFPromise;
function loadJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  jsPDFPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = JSPDF_URL;
    s.onload = () => resolve(window.jspdf.jsPDF);
    s.onerror = () => { jsPDFPromise = null; reject(new Error('Failed to load jsPDF')); };
    document.head.appendChild(s);
  });
  return jsPDFPromise;
}

/* Fallback when a font can't be embedded (offline, or proprietary fonts like Arial) */
function builtinFont(font) {
  if (SERIF.includes(font)) return 'times';
  if (MONO.includes(font)) return 'courier';
  return 'helvetica';
}

/*
 * Proprietary system fonts can't be downloaded/embedded, and non-embedded PDF
 * built-ins (Times/Helvetica) get swapped by the viewer (Chrome/Edge use Foxit fonts).
 * Embed open, metric-compatible clones instead: same widths → same line breaks.
 */
const ALIASES = { 'Times New Roman': 'Tinos', 'Arial': 'Arimo', 'Georgia': 'Gelasio' };

/* Google Fonts as static TTFs from Fontsource's CDN (jsPDF needs TTF, not woff2) */
const FONTSOURCE = 'https://cdn.jsdelivr.net/fontsource/fonts';
const STYLES = { normal: '400-normal', bold: '700-normal', italic: '400-italic', bolditalic: '700-italic' };
const fontCache = new Map(); // font name → Promise<{style: base64|null}>

const toBase64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

function fetchFontFiles(font) {
  if (!fontCache.has(font)) {
    const id = font.toLowerCase().replace(/\s+/g, '-');   // "Source Sans 3" → "source-sans-3"
    const get = (v) => fetch(`${FONTSOURCE}/${id}@latest/latin-${v}.ttf`)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((b) => (b ? toBase64(b) : null))
      .catch(() => null);
    const p = Promise.all(Object.entries(STYLES).map(async ([k, v]) => [k, await get(v)]))
      .then(Object.fromEntries);
    fontCache.set(font, p);
    p.then((f) => { if (!f.normal) fontCache.delete(font); }); // don't cache failures
  }
  return fontCache.get(font);
}

/**
 * Register the selected font with jsPDF. Missing styles fall back
 * (bolditalic → bold → normal, italic → normal) so every style name resolves.
 * @returns {Promise<string>} the jsPDF font family name to use
 */
async function registerFont(doc, font) {
  const source = ALIASES[font] || font;   // e.g. 'Times New Roman' → 'Tinos'
  const files = await fetchFontFiles(source);
  if (!files.normal) return builtinFont(font);

  // Name the PDF font after the file we embed, never 'TimesNewRoman'/'Arial':
  // PDF viewers treat those names as standard-14 aliases and swap in their own font.
  const fam = source.replace(/\s+/g, '');
  const pick = {
    normal: files.normal,
    bold: files.bold || files.normal,
    italic: files.italic || files.normal,
    bolditalic: files.bolditalic || files.bold || files.italic || files.normal,
  };
  for (const [style, b64] of Object.entries(pick)) {
    const file = `${fam}-${style}.ttf`;
    doc.addFileToVFS(file, b64);
    doc.addFont(file, fam, style);
  }
  return fam;
}

const normalizeUrl = (u) =>
  /^(https?:|mailto:|tel:)/i.test(u) ? u : 'https://' + u;

/** Rich-text description HTML → [{ type: 'p'|'li', text, n? }] */
function htmlToBlocks(html) {
  if (!html) return [];
  const root = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstChild;
  const blocks = [];
  const clean = (t) => t.replace(/\s+/g, ' ').trim();
  let inline = '';
  const flush = () => { const t = clean(inline); if (t) blocks.push({ type: 'p', text: t }); inline = ''; };

  for (const node of root.childNodes) {
    const tag = node.nodeName;
    if (tag === 'UL' || tag === 'OL') {
      flush();
      [...node.children].forEach((li, i) => {
        const t = clean(li.textContent);
        if (t) blocks.push({ type: 'li', text: t, n: tag === 'OL' ? i + 1 : null });
      });
    } else if (tag === 'BR') {
      flush();
    } else if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4'].includes(tag)) {
      flush(); inline = node.textContent; flush();
    } else {
      inline += node.textContent; // text nodes, <b>, <i>, <a>, <span>…
    }
  }
  flush();
  return blocks;
}

export async function downloadPDF(resume, filename) {
  const jsPDF = await loadJsPDF();
  const s = resume.settings;
  const p = resume.personal;

  const doc = new jsPDF({ unit: 'pt', format: s.paper === 'Letter' ? 'letter' : 'a4', compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = (MARGINS_MM[s.margins] || 16) * MM;
  const CW = W - 2 * M;               // content width
  const FONT = await registerFont(doc, s.font);
  const BASE = Number(s.baseSize) || 10.5;
  const LH = Number(s.lineHeight) || 1.4;
  const GAP = (Number(s.sectionSpacing) || 14) * 0.75;
  const ACCENT = s.accent || '#000000';
  const centered = (s.layout || 'classic') === 'classic';
  let y = M;

  doc.setProperties({ title: filename, author: p.fullName || '', subject: 'Resume', creator: 'cvbuild' });

  /* ---------- primitives ---------- */
  const set = (size, style = 'normal', color = '#111111') => {
    doc.setFont(FONT, style); doc.setFontSize(size); doc.setTextColor(color);
  };
  const lineH = (size) => size * LH;
  const ensure = (h) => { if (y + h > H - M) { doc.addPage(); y = M; } };

  /** Wrapped paragraph. Returns nothing; advances y. */
  const para = (text, { size = BASE, style = 'normal', x = M, width = CW, align = 'left', color } = {}) => {
    set(size, style, color);
    const lines = doc.splitTextToSize(text, width);
    for (const ln of lines) {
      ensure(lineH(size));
      const tx = align === 'center' ? W / 2 : x;
      doc.text(ln, tx, y + size, { align, baseline: 'alphabetic' });
      y += lineH(size);
    }
  };

  /** "Label: rest" on wrapped lines, label in bold. */
  const labeledLine = (label, rest, size = BASE) => {
    set(size, 'bold');
    const lw = label ? doc.getTextWidth(label + ' ') : 0;
    set(size, 'normal');
    const words = rest.split(/\s+/).filter(Boolean);
    let line = '', first = true;
    const out = [];
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      const max = first ? CW - lw : CW;
      if (doc.getTextWidth(test) > max && line) { out.push(line); line = w; first = false; }
      else line = test;
    }
    if (line || !out.length) out.push(line);
    out.forEach((ln, i) => {
      ensure(lineH(size));
      if (i === 0 && label) {
        set(size, 'bold'); doc.text(label, M, y + size);
        set(size, 'normal'); doc.text(ln, M + lw, y + size);
      } else {
        set(size, 'normal'); doc.text(ln, M, y + size);
      }
      y += lineH(size);
    });
  };

  const bullet = (text, n) => {
    const indent = 14;
    set(BASE, 'normal');
    const lines = doc.splitTextToSize(text, CW - indent);
    lines.forEach((ln, i) => {
      ensure(lineH(BASE));
      if (i === 0) doc.text(n ? `${n}.` : '•', M + 3, y + BASE);
      doc.text(ln, M + indent, y + BASE);
      y += lineH(BASE);
    });
  };

  /* ---------- header ---------- */
  if (p.fullName) {
    const size = BASE * 1.9;
    para(p.fullName, { size, style: 'bold', align: centered ? 'center' : 'left', color: '#000000' });
  }
  if (p.jobTitle) para(p.jobTitle, { size: BASE * 1.05, align: centered ? 'center' : 'left', color: '#333333' });

  // Contact items (clickable), wrapped into rows
  const items = [];
  if (p.email) items.push({ t: p.email, url: 'mailto:' + p.email });
  if (p.phone) items.push({ t: p.phone, url: 'tel:' + p.phone.replace(/[^\d+]/g, '') });
  if (p.location) items.push({ t: p.location });
  if (p.website) items.push({ t: p.website, url: normalizeUrl(p.website) });
  if (p.linkedin) items.push({ t: 'LinkedIn', url: normalizeUrl(p.linkedin) });
  if (p.github) items.push({ t: 'GitHub', url: normalizeUrl(p.github) });
  for (const c of p.customLinks || []) if (c.label && c.url) items.push({ t: c.label, url: normalizeUrl(c.url) });

  if (items.length) {
    const size = BASE * 0.92;
    set(size, 'normal', '#333333');
    const sep = '  ·  ';
    const sepW = doc.getTextWidth(sep);
    const rows = [[]];
    let rowW = 0;
    for (const it of items) {
      const w = doc.getTextWidth(it.t);
      const add = rows.at(-1).length ? sepW + w : w;
      if (rowW + add > CW && rows.at(-1).length) { rows.push([]); rowW = 0; }
      rows.at(-1).push(it); rowW += rows.at(-1).length > 1 ? sepW + w : w;
    }
    for (const row of rows) {
      ensure(lineH(size));
      const total = row.reduce((a, it, i) => a + doc.getTextWidth(it.t) + (i ? sepW : 0), 0);
      let x = centered ? (W - total) / 2 : M;
      row.forEach((it, i) => {
        if (i) { doc.text(sep, x, y + size); x += sepW; }
        if (it.url) doc.textWithLink(it.t, x, y + size, { url: it.url });
        else doc.text(it.t, x, y + size);
        x += doc.getTextWidth(it.t);
      });
      y += lineH(size);
    }
  }

  /* ---------- sections ---------- */
  const heading = (title) => {
    const size = BASE * 1.05;
    ensure(lineH(size) + 6 + lineH(BASE) * 2);   // keep heading with first lines
    y += GAP * 0.6;
    const label = s.headingStyle === 'uppercase' ? title.toUpperCase() : title;
    set(size, 'bold', ACCENT);
    doc.text(label, M, y + size);
    y += lineH(size);
    doc.setDrawColor(ACCENT); doc.setLineWidth(0.8);
    doc.line(M, y, W - M, y);
    y += 5;
  };

  for (const sec of resume.sections) {
    if (sec.hidden) continue;
    const entries = sec.entries.filter((e) => !e.hidden);
    if (!entries.length) continue;

    if (sec.type === 'skills') {
      const flat = entries.filter((e) => !('category' in e) && e.title).map((e) => e.title);
      const groups = entries.filter((e) => 'category' in e && (e.title || e.category));
      if (!flat.length && !groups.length) continue;
      heading(sec.title);
      for (const g of groups) labeledLine(g.category ? g.category + ':' : '', g.title || '');
      if (flat.length) para(flat.join('  ·  '));
      continue;
    }

    heading(sec.title);

    if (sec.type === 'profile') {
      for (const b of htmlToBlocks(entries[0]?.description)) b.type === 'li' ? bullet(b.text, b.n) : para(b.text);
      continue;
    }

    entries.forEach((e, idx) => {
      if (idx) y += GAP * 0.35;
      const dates = formatRange(e.start, e.end, e.present, s.dateFormat);
      const org = [e.organization, e.location].filter(Boolean).join(' — ');
      ensure(lineH(BASE) * (org ? 3 : 2));      // keep title/org with first bullet

      // Title (left, bold) + dates (right)
      set(BASE, 'normal', '#333333');
      const dw = dates ? doc.getTextWidth(dates) : 0;
      set(BASE, 'bold');
      const titleLines = doc.splitTextToSize(e.title || '', CW - dw - 12);
      titleLines.forEach((ln, i) => {
        ensure(lineH(BASE));
        set(BASE, 'bold', '#111111');
        doc.text(ln, M, y + BASE);
        if (i === 0 && dates) {
          set(BASE, 'normal', '#333333');
          doc.text(dates, W - M, y + BASE, { align: 'right' });
        }
        y += lineH(BASE);
      });

      if (org) para(org, { style: 'italic', color: '#333333' });
      for (const b of htmlToBlocks(e.description)) b.type === 'li' ? bullet(b.text, b.n) : para(b.text);
    });
  }

  doc.save(`${filename}.pdf`);
}
