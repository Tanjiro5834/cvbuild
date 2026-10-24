/**
 * @file Rich text toolbar binding for contenteditable elements.
 * Uses document.execCommand (deprecated but functional) for simple formatting.
 * Toolbar markup uses inline SVG icons + aria-labels.
 */
import { sanitizeHTML } from '../utils.js';

const ICONS = {
  bold: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h7a4 4 0 0 1 0 8H6zM6 12h8a4 4 0 0 1 0 8H6z"/></svg>',
  italic: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 4h-9M14 20H5M15 4 9 20"/></svg>',
  underline: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4v6a6 6 0 0 0 12 0V4M4 20h16"/></svg>',
  ul: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>',
  ol: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 6h11M10 12h11M10 18h11M4 4h2v4M4 20h3M4 16h3v4M4 16h3"/></svg>',
  link: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  clear: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

const TOOLBAR_HTML = `
  <div class="rt-toolbar" data-toolbar role="toolbar" aria-label="Text formatting">
    <button type="button" data-cmd="bold" aria-label="Bold" title="Bold">${ICONS.bold}</button>
    <button type="button" data-cmd="italic" aria-label="Italic" title="Italic">${ICONS.italic}</button>
    <button type="button" data-cmd="underline" aria-label="Underline" title="Underline">${ICONS.underline}</button>
    <span class="rt-sep" aria-hidden="true"></span>
    <button type="button" data-cmd="insertUnorderedList" aria-label="Bulleted list" title="Bulleted list">${ICONS.ul}</button>
    <button type="button" data-cmd="insertOrderedList" aria-label="Numbered list" title="Numbered list">${ICONS.ol}</button>
    <span class="rt-sep" aria-hidden="true"></span>
    <button type="button" data-cmd="createLink" aria-label="Insert link" title="Insert link">${ICONS.link}</button>
    <button type="button" data-cmd="removeFormat" aria-label="Clear formatting" title="Clear formatting">${ICONS.clear}</button>
  </div>
`;

/**
 * Attach a toolbar to an editable element.
 * @param {HTMLElement} editable
 * @param {(html:string)=>void} onChange
 */
export function attachRichText(editable, onChange) {
  const wrapper = editable.parentElement;
  if (wrapper && !wrapper.querySelector('[data-toolbar]')) {
    wrapper.insertAdjacentHTML('afterbegin', TOOLBAR_HTML);
  }
  const toolbar = wrapper.querySelector('[data-toolbar]');

  toolbar.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) e.preventDefault();
  });
  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cmd]');
    if (!btn) return;
    e.preventDefault();
    const cmd = btn.dataset.cmd;
    editable.focus();
    if (cmd === 'createLink') {
      const url = prompt('Enter URL (https://…)');
      if (url) {
        const safe = url.startsWith('http') ? url : 'https://' + url;
        document.execCommand('createLink', false, safe);
      }
    } else {
      document.execCommand(cmd, false, null);
    }
    onChange(sanitizeHTML(editable.innerHTML));
  });

  editable.addEventListener('input', () => {
    onChange(sanitizeHTML(editable.innerHTML));
  });
  editable.addEventListener('blur', () => {
    onChange(sanitizeHTML(editable.innerHTML));
  });
}