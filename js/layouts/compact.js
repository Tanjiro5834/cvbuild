/**
 * Compact layout: tight spacing for dense 1-page resumes.
 */
import { escapeHTML, formatRange } from '../utils.js';
import { contactLine, skillItemHTML } from './_shared.js';

export function renderLayout(resume) {
  const { personal, sections, settings } = resume;
  const header = `
    <header class="resume-header compact-header">
      ${personal.fullName ? `<h1 class="name">${escapeHTML(personal.fullName)}</h1>` : ''}
      ${personal.jobTitle ? `<span class="jobtitle">${escapeHTML(personal.jobTitle)}</span>` : ''}
      <div class="contact">${contactLine(personal)}</div>
    </header>`;

  const body = sections
    .filter(s => !s.hidden && s.entries.some(e => !e.hidden))
    .map(section => renderSection(section, settings))
    .join('');

  return `<div class="resume layout-compact">${header}<main>${body}</main></div>`;
}

function renderSection(section, settings) {
  const entries = section.entries.filter(e => !e.hidden);
  if (!entries.length) return '';
  const fmt = settings.dateFormat;

  const items = entries.map(entry => {
    if (section.type === 'skills') {
      return skillItemHTML(entry);
    }
    if (section.type === 'profile') {
      return `<div class="entry">${entry.description || ''}</div>`;
    }
    const dates = formatRange(entry.start, entry.end, entry.present, fmt);
    return `
      <div class="entry">
        <div class="entry-head">
          <span class="entry-title">${escapeHTML(entry.title)}</span>
          ${entry.organization ? `<span class="entry-org-inline">, ${escapeHTML(entry.organization)}</span>` : ''}
          ${dates ? `<span class="entry-dates">${escapeHTML(dates)}</span>` : ''}
        </div>
        ${entry.description ? `<div class="entry-desc">${entry.description}</div>` : ''}
      </div>`;
  });

  const inner = section.type === 'skills'
    ? `<ul class="skills-list">${items.join('')}</ul>`
    : items.join('');

  return `
    <section class="resume-section">
      <h2 class="section-title">${escapeHTML(section.title)}</h2>
      ${inner}
    </section>`;
}