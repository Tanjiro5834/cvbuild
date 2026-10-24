/**
 * Classic layout: centered header, horizontal dividers.
 */
import { escapeHTML, formatRange } from '../utils.js';
import { contactLine } from './_shared.js';

export function renderLayout(resume) {
  const { personal, sections, settings } = resume;
  const fmt = settings.dateFormat;

  const header = `
    <header class="resume-header classic-header">
      ${personal.fullName ? `<h1 class="name">${escapeHTML(personal.fullName)}</h1>` : ''}
      ${personal.jobTitle ? `<div class="jobtitle">${escapeHTML(personal.jobTitle)}</div>` : ''}
      <div class="contact">${contactLine(personal)}</div>
    </header>`;

  const body = sections
    .filter(s => !s.hidden && s.entries.some(e => !e.hidden))
    .map(section => renderClassicSection(section, settings))
    .join('');

  return `<div class="resume layout-classic">${header}<main>${body}</main></div>`;
}

function renderClassicSection(section, settings) {
  const entries = section.entries.filter(e => !e.hidden);
  if (!entries.length) return '';
  const fmt = settings.dateFormat;

  const items = entries.map(entry => {
    if (section.type === 'skills') {
      return `<li class="skill-item">${escapeHTML(entry.title)}</li>`;
    }
    if (section.type === 'profile') {
      return `<div class="entry profile-entry">${entry.description || ''}</div>`;
    }
    const dates = formatRange(entry.start, entry.end, entry.present, fmt);
    const orgLine = [entry.organization, entry.location].filter(Boolean).map(escapeHTML).join(' — ');
    return `
      <div class="entry">
        <div class="entry-head">
          ${entry.title ? `<div class="entry-title">${escapeHTML(entry.title)}</div>` : ''}
          ${dates ? `<div class="entry-dates">${escapeHTML(dates)}</div>` : ''}
        </div>
        ${orgLine ? `<div class="entry-org">${orgLine}</div>` : ''}
        ${entry.description ? `<div class="entry-desc">${entry.description}</div>` : ''}
      </div>`;
  });

  const listWrap = section.type === 'skills'
    ? `<ul class="skills-list">${items.join('')}</ul>`
    : items.join('');

  return `
    <section class="resume-section">
      <h2 class="section-title">${escapeHTML(section.title)}</h2>
      ${listWrap}
    </section>`;
}