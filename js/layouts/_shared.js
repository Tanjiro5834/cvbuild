/**
 * @file Shared helpers for layout renderers.
 */
import { escapeHTML, formatRange, sanitizeHTML } from '../utils.js';

export function contactLine(personal, sep = ' · ') {
  const items = [];
  if (personal.email) items.push(`<a href="mailto:${escapeHTML(personal.email)}">${escapeHTML(personal.email)}</a>`);
  if (personal.phone) items.push(`<a href="tel:${escapeHTML(personal.phone.replace(/[^\d+]/g,''))}">${escapeHTML(personal.phone)}</a>`);
  if (personal.location) items.push(escapeHTML(personal.location));
  if (personal.website) items.push(link(personal.website, personal.website));
  if (personal.linkedin) items.push(link(personal.linkedin, 'LinkedIn'));
  if (personal.github) items.push(link(personal.github, 'GitHub'));
  for (const c of personal.customLinks || []) {
    if (c.label && c.url) items.push(link(c.url, c.label));
  }
  return items.join(`<span class="sep">${sep}</span>`);
}

function link(url, label) {
  let href = url;
  if (!/^https?:\/\//i.test(href) && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
    href = 'https://' + href;
  }
  return `<a href="${escapeHTML(href)}" target="_blank" rel="noopener">${escapeHTML(label)}</a>`;
}

/** Render a single entry (structural body only). Returns HTML. */
export function renderEntryBody(entry) {
  const desc = entry.description ? sanitizeHTML(entry.description) : '';
  return desc;
}

export function renderSectionHeading(title) {
  return `<h2 class="section-title">${escapeHTML(title)}</h2>`;
}
/**
 * Skill row. Entries with a `category` key are groups ("Backend: Java, Spring Boot"),
 * legacy entries without it are single inline skills.
 */
export function skillItemHTML(entry) {
  if (!entry.title && !entry.category) return '';
  if ('category' in entry) {
    const cat = entry.category ? `<span class="skill-cat">${escapeHTML(entry.category)}:</span> ` : '';
    return `<li class="skill-group">${cat}${escapeHTML(entry.title)}</li>`;
  }
  return `<li class="skill-item">${escapeHTML(entry.title)}</li>`;
}
