/**
 * @file ATS Check panel: warns about common parsing pitfalls.
 */
import { escapeHTML, htmlToText } from './utils.js';

/**
 * @param {import('../store.js').Resume} resume
 * @returns {Array<{level:'warn'|'error'|'ok', message:string}>}
 */
export function runATSCheck(resume) {
  const results = [];
  const p = resume.personal;

  if (!p.fullName) results.push({ level: 'warn', message: 'Missing full name.' });
  if (!p.email && !p.phone) results.push({ level: 'warn', message: 'Missing email and phone.' });
  else {
    if (!p.email) results.push({ level: 'warn', message: 'Missing email.' });
    if (!p.phone) results.push({ level: 'warn', message: 'Missing phone.' });
  }
  if (!p.location) results.push({ level: 'warn', message: 'Missing location.' });

  // Empty sections
  for (const s of resume.sections) {
    if (s.hidden) continue;
    const visible = s.entries.filter(e => !e.hidden);
    if (!visible.length) {
      results.push({ level: 'warn', message: `Section "${s.title}" is empty.` });
      continue;
    }
    for (const e of visible) {
      const text = htmlToText(e.description || '');
      if (e.description && text.trim() === '' && !e.title) {
        results.push({ level: 'warn', message: `Empty entry in "${s.title}".` });
      }
      if (text) {
        const words = text.split(/\s+/).filter(Boolean).length;
        if (words > 30) {
          results.push({ level: 'warn', message: `Long bullet (~${words} words) in "${s.title}". Keep bullets ≤ 30 words.` });
        }
      }
    }
  }

  // Special characters that parse badly
  const badChars = /[^\x00-\x7F]/g;
  const allText = JSON.stringify(resume);
  const bad = allText.match(badChars);
  if (bad && bad.length > 0) {
    const unique = [...new Set(bad)].slice(0, 6).join(' ');
    results.push({ level: 'warn', message: `Non-ASCII characters detected (${unique}). ATS may misparse.` });
  }

  if (results.length === 0) {
    results.push({ level: 'ok', message: 'No ATS issues detected.' });
  }
  return results;
}

/** Render the ATS panel content as HTML. */
export function renderATSPanel(resume, pageCount) {
  const results = runATSCheck(resume);
  const pageWarn = pageCount > 2;
  if (pageWarn) {
    results.unshift({ level: 'warn', message: `Estimated length: ${pageCount} pages. Consider trimming to ≤ 2.` });
  }
  const items = results.map(r => {
    const icon = r.level === 'ok' ? '✓' : '⚠';
    return `<li class="ats-item ats-${r.level}"><span class="ats-icon">${icon}</span>${escapeHTML(r.message)}</li>`;
  }).join('');
  return `
    <div class="ats-header">
      <b>ATS Check</b>
      <span class="ats-pages">${pageCount} page${pageCount === 1 ? '' : 's'}</span>
    </div>
    <ul class="ats-list">${items}</ul>`;
}

/** Estimate page count from preview element height vs page size. */
export function estimatePageCount(previewEl) {
  if (!previewEl) return 1;
  const pageHeightA4 = 1122;   // 210mm @ 96dpi ≈ 794 x 1123
  const pageHeightLetter = 1056;
  const paper = previewEl.dataset.paper || 'A4';
  const pageH = paper === 'Letter' ? pageHeightLetter : pageHeightA4;
  const h = previewEl.scrollHeight;
  return Math.max(1, Math.ceil(h / pageH));
}