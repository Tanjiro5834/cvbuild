/**
 * @file App bootstrap, hash-based routing, dashboard, editor mounting.
 */
import * as db from './db.js';
import {
  subscribe, getState, loadResume, clearResume, mutate, getCurrentResume,
  undo, redo, canUndo, canRedo, createEmptyResume, DEFAULT_SETTINGS
} from './store.js';
import { uuid, escapeHTML, debounce } from './utils.js';
import { renderEditor } from './editor/form.js';
import { initDnD } from './editor/dnd.js';
import { LAYOUTS } from './layouts/index.js';
import { renderATSPanel, estimatePageCount } from './ats-check.js';
import { exportPDF, exportTXT, exportJSON, importJSONFile, buildFilename } from './export.js';
import { seedResume } from './seed.js';

const app = document.getElementById('app');

/* ---------------- Save with debounce ---------------- */
const saveToDB = debounce(async (resume) => {
  if (!resume) return;
  try {
    await db.put(JSON.parse(JSON.stringify(resume)));
    const st = getState();
    document.querySelectorAll('[data-save-status]').forEach(el => {
      el.textContent = 'Saved';
      el.classList.add('saved');
    });
  } catch (e) {
    console.error('Save failed', e);
  }
}, 500);

subscribe((state) => {
  if (state.currentResume) saveToDB(state.currentResume);
});

/* ---------------- Router ---------------- */
function route() {
  const hash = location.hash.replace(/^#/, '');
  if (hash.startsWith('editor/')) {
    const id = hash.split('/')[1];
    openEditor(id);
  } else {
    showDashboard();
  }
}

window.addEventListener('hashchange', route);

/* ---------------- Dashboard ---------------- */
async function showDashboard() {
  clearResume();
  const list = await db.getAll();
  // Seed on first ever run
  if (list.length === 0) {
    const seed = seedResume();
    await db.put(seed);
    list.push(seed);
  }
  list.sort((a, b) => b.updatedAt - a.updatedAt);

  app.innerHTML = `
    <div class="dashboard">
      <header class="dash-header">
        <div class="brand">
          <div class="logo">ATS</div>
          <div>
            <h1>Resume Builder</h1>
            <p>ATS-friendly resumes. Unlimited. Free.</p>
          </div>
        </div>
        <button class="btn-primary" data-action="new">+ New Resume</button>
      </header>

      <section class="dash-list">
        ${list.length === 0
          ? `<div class="empty">No resumes yet. Create one to get started.</div>`
          : list.map(r => resumeCard(r)).join('')}
      </section>

      <footer class="dash-footer">
        <button class="btn-ghost" data-action="import-backup">Import JSON backup</button>
        <input type="file" accept="application/json" data-file-import hidden />
      </footer>
    </div>
  `;

  app.querySelector('[data-action="new"]').addEventListener('click', async () => {
    const title = prompt('Resume title?', 'Untitled Resume');
    if (!title) return;
    const r = createEmptyResume(title);
    await db.put(JSON.parse(JSON.stringify(r)));
    location.hash = `#editor/${r.id}`;
  });

  app.querySelector('[data-action="import-backup"]').addEventListener('click', () => {
    app.querySelector('[data-file-import]').click();
  });
  app.querySelector('[data-file-import]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await importJSONFile(file);
      if (!data.id) data.id = uuid();
      data.updatedAt = Date.now();
      await db.put(data);
      route();
    } catch (err) {
      alert('Invalid JSON file.');
    }
  });

  app.querySelector('.dash-list').addEventListener('click', async (e) => {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    const id = card.dataset.id;
    const action = e.target.closest('[data-act]')?.dataset.act;
    if (action === 'open' || !action) {
      location.hash = `#editor/${id}`;
      return;
    }
    if (action === 'rename') {
      const title = prompt('New title?', card.querySelector('.card-title').textContent);
      if (!title) return;
      const r = await db.get(id);
      r.title = title;
      r.updatedAt = Date.now();
      await db.put(r);
      route();
      return;
    }
    if (action === 'duplicate') {
      const r = await db.get(id);
      const copy = JSON.parse(JSON.stringify(r));
      copy.id = uuid();
      copy.title = r.title + ' (copy)';
      copy.updatedAt = Date.now();
      await db.put(copy);
      route();
      return;
    }
    if (action === 'delete') {
      if (!confirm('Delete this resume permanently?')) return;
      await db.del(id);
      route();
      return;
    }
  });
}

function resumeCard(r) {
  const date = new Date(r.updatedAt || Date.now());
  const fmt = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `
    <div class="resume-card" data-id="${r.id}">
      <div class="card-main">
        <div class="card-title">${escapeHTML(r.title)}</div>
        <div class="card-meta">Last edited ${fmt}</div>
      </div>
      <div class="card-actions">
        <button data-act="open">Open</button>
        <button data-act="rename">Rename</button>
        <button data-act="duplicate">Duplicate</button>
        <button data-act="delete" class="danger">Delete</button>
      </div>
    </div>`;
}

/* ---------------- Editor ---------------- */
let editorMounted = false;
let unsubEditor = null;

async function openEditor(id) {
  let resume = await db.get(id);
  if (!resume) {
    location.hash = '';
    return;
  }
  // Ensure settings defaults are present for older records
  resume.settings = { ...DEFAULT_SETTINGS, ...(resume.settings || {}) };

  app.innerHTML = `
    <div class="editor-root">
      <header class="editor-topbar">
        <button class="btn-ghost" data-action="back">← Dashboard</button>
        <input class="title-input" data-title-input value="${escapeHTML(resume.title)}" />
        <span class="save-status" data-save-status>Saved</span>
        <div class="topbar-actions">
          <button class="btn-ghost" data-action="undo" title="Undo">↶</button>
          <button class="btn-ghost" data-action="redo" title="Redo">↷</button>
          <button class="btn-ghost" data-action="export-json">JSON</button>
          <button class="btn-ghost" data-action="export-txt">TXT</button>
          <button class="btn-primary" data-action="download-pdf">Download PDF</button>
        </div>
      </header>

      <div class="editor-layout">
        <aside class="editor-sidebar" data-editor-form></aside>

        <section class="preview-pane">
          <div class="preview-toolbar">
            <div class="segmented" data-mobile-toggle>
              <button data-tab="edit" class="active">Edit</button>
              <button data-tab="preview">Preview</button>
            </div>
            <div class="ats-badge" data-ats-badge>ATS Check</div>
          </div>
          <div class="preview-scroll">
            <div class="preview-page" data-preview></div>
          </div>
          <div class="ats-panel hidden" data-ats-panel></div>
        </section>
      </div>
    </div>
  `;

  loadResume(resume);

  const formEl = app.querySelector('[data-editor-form]');
  const previewEl = app.querySelector('[data-preview]');
  const atsPanel = app.querySelector('[data-ats-panel]');
  const atsBadge = app.querySelector('[data-ats-badge]');

  renderEditor(formEl, resume, {});

  // Title input
  app.querySelector('[data-title-input]').addEventListener('input', (e) => {
    mutate(r => { r.title = e.target.value; });
  });

  // Undo/redo/export/back
  app.querySelector('.topbar-actions').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'undo') undo();
    else if (a === 'redo') redo();
    else if (a === 'download-pdf') exportPDF(getCurrentResume());
    else if (a === 'export-txt') exportTXT(getCurrentResume());
    else if (a === 'export-json') exportJSON(getCurrentResume());
  });
  app.querySelector('[data-action="back"]').addEventListener('click', () => { location.hash = ''; });

  // DnD
  initDnD(formEl, (payload) => {
    mutate(r => {
      if (payload.type === 'section') {
        const from = r.sections.findIndex(s => s.id === payload.id);
        const to = r.sections.findIndex(s => s.id === payload.targetId);
        if (from < 0 || to < 0) return;
        const [moved] = r.sections.splice(from, 1);
        r.sections.splice(to, 0, moved);
      } else if (payload.type === 'entry') {
        const s = r.sections.find(x => x.id === payload.parent);
        if (!s) return;
        const from = s.entries.findIndex(x => x.id === payload.id);
        const to = s.entries.findIndex(x => x.id === payload.targetId);
        if (from < 0 || to < 0) return;
        const [moved] = s.entries.splice(from, 1);
        s.entries.splice(to, 0, moved);
      }
    });
  });

  // ATS panel toggle
  atsBadge.addEventListener('click', () => {
    atsPanel.classList.toggle('hidden');
    updateATS();
  });

  // Mobile toggle
  app.querySelector('[data-mobile-toggle]').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    app.querySelectorAll('[data-mobile-toggle] button').forEach(b => b.classList.toggle('active', b === btn));
    const tab = btn.dataset.tab;
    app.querySelector('.editor-layout').dataset.mobileTab = tab;
  });

  /* ---- Preview render (rAF-throttled) ---- */
  let pending = false;
  function scheduleRender() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      renderPreview();
    });
  }

  function renderPreview() {
    const st = getState();
    const r = st.currentResume;
    if (!r) return;
    const layout = LAYOUTS[r.settings.layout] || LAYOUTS.classic;
    previewEl.dataset.paper = r.settings.paper;
    previewEl.dataset.margins = r.settings.margins;
    previewEl.dataset.headingStyle = r.settings.headingStyle;
    previewEl.style.setProperty('--font-body', `'${r.settings.font}', sans-serif`);
    previewEl.style.setProperty('--fs-base', `${r.settings.baseSize}pt`);
    previewEl.style.setProperty('--lh', r.settings.lineHeight);
    previewEl.style.setProperty('--section-spacing', `${r.settings.sectionSpacing}px`);
    previewEl.style.setProperty('--accent', r.settings.accent);
    previewEl.innerHTML = layout.render(r);
    updatePrintPage(r.settings);

    // Update editor form when undo/redo swaps state
    if (formEl.dataset.dirtySignature !== JSON.stringify(r.sections.map(s => s.id))) {
      formEl.dataset.dirtySignature = JSON.stringify(r.sections.map(s => s.id));
    }
    updateUndoButtons();
    updateATS();
  }

  function updateUndoButtons() {
    const u = app.querySelector('[data-action="undo"]');
    const rd = app.querySelector('[data-action="redo"]');
    u.disabled = !canUndo();
    rd.disabled = !canRedo();
  }

  function updateATS() {
    const r = getCurrentResume();
    if (!r) return;
    const pages = estimatePageCount(previewEl);
    atsPanel.innerHTML = renderATSPanel(r, pages);
    const issues = atsPanel.querySelectorAll('.ats-warn').length;
    atsBadge.textContent = issues > 0 ? `ATS Check · ${issues}` : 'ATS Check ✓';
    atsBadge.classList.toggle('warn', issues > 0);
  }

  /* Re-render form on structural changes (add/remove/undo). */
  unsubEditor && unsubEditor();
  unsubEditor = subscribe((state) => {
    scheduleRender();
    if (!state.currentResume) return;
    // If section ids / entry ids changed vs. what's in the DOM, re-render form
    const sig = JSON.stringify(state.currentResume.sections.map(s => ({
      id: s.id, entries: s.entries.map(e => e.id)
    })));
    if (formEl.dataset.structureSig !== sig) {
      formEl.dataset.structureSig = sig;
      renderEditor(formEl, state.currentResume, {});
    }
    // Sync title input if changed externally (undo/redo)
    const ti = app.querySelector('[data-title-input]');
    if (ti && document.activeElement !== ti && ti.value !== state.currentResume.title) {
      ti.value = state.currentResume.title;
    }
  });

  editorMounted = true;
  scheduleRender();
}

/* Dynamically update the @page size. */
function updatePrintPage(settings) {
  const styleId = 'dynamic-page-style';
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }
  const page = settings.paper === 'Letter' ? 'letter' : 'A4';
  const marginMap = { narrow: '10mm', normal: '16mm', wide: '22mm' };
  const m = marginMap[settings.margins] || '16mm';
  style.textContent = `@page { size: ${page}; margin: ${m}; }`;
}

/* ---------------- Boot ---------------- */
route();