/**
 * @file Export helpers: PDF (print), TXT, JSON backup/restore.
 */
import { downloadBlob, htmlToText } from './utils.js';

export function buildFilename(resume) {
  const name = (resume.personal.fullName || 'Resume').trim().replace(/\s+/g, '_');
  return `${name}_Resume`;
}

export function exportPDF(resume) {
  const original = document.title;
  document.title = buildFilename(resume);
  // Give the browser a tick to update the title
  setTimeout(() => {
    window.print();
    // restore title after print dialog closes (best-effort)
    setTimeout(() => { document.title = original; }, 500);
  }, 50);
}

export function exportTXT(resume) {
  const lines = [];
  const p = resume.personal;
  if (p.fullName) lines.push(p.fullName);
  if (p.jobTitle) lines.push(p.jobTitle);
  const contact = [p.email, p.phone, p.location, p.website, p.linkedin, p.github]
    .filter(Boolean).join(' | ');
  if (contact) lines.push(contact);
  lines.push('');

  for (const s of resume.sections) {
    if (s.hidden) continue;
    const entries = s.entries.filter(e => !e.hidden);
    if (!entries.length) continue;
    lines.push(s.title.toUpperCase());
    lines.push('-'.repeat(Math.min(s.title.length + 4, 40)));
    for (const e of entries) {
      const head = [e.title, e.organization, e.location].filter(Boolean).join(' — ');
      if (head) lines.push(head);
      const dates = [e.start, e.present ? 'Present' : e.end].filter(Boolean).join(' – ');
      if (dates) lines.push(dates);
      if (e.description) {
        const text = htmlToText(e.description);
        if (text) lines.push(text);
      }
      lines.push('');
    }
    lines.push('');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, buildFilename(resume) + '.txt');
}

export function exportJSON(resume) {
  const blob = new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' });
  downloadBlob(blob, buildFilename(resume) + '.json');
}

/** Read a JSON File and resolve to parsed object. */
export function importJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result)); }
      catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}