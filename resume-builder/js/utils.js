/**
 * @file Utility helpers: debounce, sanitize, uuid, date formatting, escaping.
 */

/** Generate a RFC4122-ish UUID (v4). @returns {string} */
export function uuid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Debounce a function.
 * @template {(...args:any[])=>any} F
 * @param {F} fn
 * @param {number} wait
 * @returns {(...args:Parameters<F>)=>void}
 */
export function debounce(fn, wait = 500) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

/** Escape a string for safe HTML text content. */
export function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize HTML string using an allowlist.
 * Allowlist: b, i, u, a, ul, ol, li, p, br
 * @param {string} html
 * @returns {string}
 */
export function sanitizeHTML(html) {
  if (!html) return '';
  const allowedTags = new Set(['B', 'I', 'U', 'A', 'UL', 'OL', 'LI', 'P', 'BR']);
  const template = document.createElement('template');
  template.innerHTML = html;

  const walk = (node) => {
    const children = [...node.childNodes];
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!allowedTags.has(child.tagName)) {
          // unwrap disallowed tag: replace with its children
          const frag = document.createDocumentFragment();
          while (child.firstChild) frag.appendChild(child.firstChild);
          child.replaceWith(frag);
          walk(node);
          continue;
        }
        // strip all attributes except href on <a>
        for (const attr of [...child.attributes]) {
          if (child.tagName === 'A' && attr.name === 'href') {
            const val = attr.value.trim().toLowerCase();
            if (!(val.startsWith('http://') || val.startsWith('https://') || val.startsWith('mailto:') || val.startsWith('tel:') || val.startsWith('/'))) {
              child.removeAttribute('href');
            }
          } else {
            child.removeAttribute(attr.name);
          }
        }
        walk(child);
      } else if (child.nodeType === Node.TEXT_NODE) {
        // ok
      } else {
        child.remove();
      }
    }
  };
  walk(template.content);
  return template.innerHTML;
}

/**
 * Format a date string (YYYY-MM or YYYY) using the given format.
 * @param {string} dateStr
 * @param {'MMM YYYY'|'MM/YYYY'|'YYYY'} format
 * @returns {string}
 */
export function formatDate(dateStr, format = 'MMM YYYY') {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  const year = parts[0];
  const month = parts[1] ? parseInt(parts[1], 10) : null;
  if (!year) return '';
  if (format === 'YYYY' || month == null) return year;
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (format === 'MM/YYYY') return `${String(month).padStart(2,'0')}/${year}`;
  return `${monthNames[month - 1]} ${year}`;
}

/**
 * Format a date range with Present support.
 * @param {string} start
 * @param {string} end
 * @param {boolean} present
 * @param {string} format
 */
export function formatRange(start, end, present, format) {
  const s = formatDate(start, format);
  const e = present ? 'Present' : formatDate(end, format);
  if (!s && !e) return '';
  if (!e) return s;
  if (!s) return e;
  return `${s} – ${e}`;
}

/** Clamp a value. */
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** Simple plain-text extraction from sanitized HTML. */
export function htmlToText(html) {
  if (!html) return '';
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || '';
}

/** Download a Blob as a file. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}