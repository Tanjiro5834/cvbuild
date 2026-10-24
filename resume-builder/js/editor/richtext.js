/**
 * @file Rich text toolbar binding for contenteditable elements.
 * Uses document.execCommand (deprecated but functional) for simple formatting.
 */
import { sanitizeHTML } from '../utils.js';

const TOOLBAR_HTML = `
  <div class="rt-toolbar" data-toolbar>
    <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
    <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
    <button type="button" data-cmd="underline" title="Underline"><u>U</u></button>
    <button type="button" data-cmd="insertUnorderedList" title="Bullet list">•</button>
    <button type="button" data-cmd="insertOrderedList" title="Numbered list">1.</button>
    <button type="button" data-cmd="createLink" title="Link">🔗</button>
    <button type="button" data-cmd="removeFormat" title="Clear">✕</button>
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
    // Prevent losing focus
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