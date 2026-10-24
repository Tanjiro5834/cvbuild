/**
 * @file App bootstrap, hash routing, dashboard + editor chrome,
 * theme toggle, toasts, confirm modal, inline rename, preview scaling.
 */
import * as db from "./db.js";
import {
  subscribe,
  getState,
  loadResume,
  clearResume,
  mutate,
  getCurrentResume,
  undo,
  redo,
  canUndo,
  canRedo,
  createEmptyResume,
  DEFAULT_SETTINGS,
} from "./store.js";
import { uuid, escapeHTML, debounce } from "./utils.js";
import { renderEditor } from "./editor/form.js";
import { initDnD } from "./editor/dnd.js";
import { LAYOUTS } from "./layouts/index.js";
import { renderATSPanel, estimatePageCount } from "./ats-check.js";
import { exportPDF, exportTXT, exportJSON, importJSONFile } from "./export.js";

const app = document.getElementById("app");
const toastsRoot = document.getElementById("toasts");
const modalRoot = document.getElementById("modal-root");

/* ---------------- Theme ---------------- */
const THEME_KEY = "theme";

function getThemePref() {
  try {
    return localStorage.getItem(THEME_KEY) || "system";
  } catch {
    return "system";
  }
}
function setThemePref(pref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {}
  applyTheme(pref);
}
function resolvedTheme(pref) {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return pref;
}
function applyTheme(pref) {
  const resolved = resolvedTheme(pref);
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-theme-pref", pref);
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.dataset.themePref = pref;
    const label = btn.querySelector("[data-theme-label]");
    if (label)
      label.textContent =
        pref === "system" ? "System" : pref === "dark" ? "Dark" : "Light";
  });
}
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if (getThemePref() === "system") applyTheme("system");
  });

/* ---------------- Toasts ---------------- */
function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.setAttribute("role", "status");
  el.innerHTML = `<span>${escapeHTML(message)}</span>`;
  toastsRoot.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 200);
  }, 2400);
}

/* ---------------- Confirm modal ---------------- */
function confirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  danger = true,
}) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h3 id="modal-title">${escapeHTML(title)}</h3>
        <p>${escapeHTML(message || "")}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-act="cancel">Cancel</button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="ok">${escapeHTML(confirmLabel)}</button>
        </div>
      </div>`;
    const close = (val) => {
      wrap.classList.remove("show");
      setTimeout(() => wrap.remove(), 150);
      resolve(val);
    };
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) close(false);
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      if (btn.dataset.act === "cancel") close(false);
      else close(true);
    });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", esc);
        close(false);
      }
    });
    modalRoot.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add("show"));
    wrap.querySelector('[data-act="cancel"]').focus();
  });
}
window.__confirmDelete = async ({ title, message, onConfirm }) => {
  const ok = await confirmDialog({ title, message });
  if (ok) {
    onConfirm();
    toast("Deleted", "success");
  }
};

/* ---------------- Save with debounce ---------------- */
const saveToDB = debounce(async (resume) => {
  if (!resume) return;
  setSaveStatus("Saving…", "saving");
  try {
    await db.put(JSON.parse(JSON.stringify(resume)));
    setSaveStatus("Saved", "saved");
  } catch (e) {
    console.error("Save failed", e);
    setSaveStatus("Save failed", "error");
  }
}, 500);

function setSaveStatus(text, kind) {
  document.querySelectorAll("[data-save-status]").forEach((el) => {
    el.textContent = text;
    el.dataset.state = kind;
  });
}

subscribe((state) => {
  if (state.currentResume) saveToDB(state.currentResume);
});

/* ---------------- First-run cleanup ---------------- */
const LEGACY_SEED_TITLE = "Alex Carter — Software Engineer";
async function cleanupSeed() {
  const list = await db.getAll();
  for (const r of list) {
    if (r.title === LEGACY_SEED_TITLE) {
      try {
        await db.del(r.id);
      } catch {}
    }
  }
}

/* ---------------- Router ---------------- */
function route() {
  const hash = location.hash.replace(/^#/, "");
  if (hash.startsWith("editor/")) {
    const id = hash.split("/")[1];
    openEditor(id);
  } else {
    showDashboard();
  }
}
window.addEventListener("hashchange", route);

/* ---------------- Dashboard ---------------- */
async function showDashboard() {
  clearResume();
  const list = await db.getAll();
  list.sort((a, b) => b.updatedAt - a.updatedAt);

  app.innerHTML = `
    <div class="app-shell">
      ${topBarHTML({ mode: "dashboard" })}
      <main class="dashboard">
        <header class="dash-head">
          <div>
            <h1>Your resumes</h1>
            <p class="muted">Create unlimited resumes. Free forever.</p>
          </div>
          <button class="btn btn-primary btn-lg" data-action="new">
            ${svgPlus()}<span>New Resume</span>
          </button>
        </header>

        ${
          list.length === 0
            ? `<div class="empty-state">
               <div class="empty-icon">${svgDoc()}</div>
               <h2>No resumes yet</h2>
               <p class="muted">Start with a blank resume and build it your way.</p>
               <button class="btn btn-primary" data-action="new">Create your first resume</button>
             </div>`
            : `<section class="resume-grid">
               ${list.map((r) => resumeCard(r)).join("")}
             </section>`
        }

        <footer class="dash-foot">
          <button class="btn btn-secondary" data-action="import-backup">
            ${svgUpload()}<span>Import JSON backup</span>
          </button>
          <input type="file" accept="application/json" data-file-import hidden />
        </footer>
      </main>
    </div>
  `;

  wireTopBar();

  app.querySelectorAll('[data-action="new"]').forEach((btn) => {
    btn.addEventListener("click", createNewResume);
  });

  app
    .querySelector('[data-action="import-backup"]')
    .addEventListener("click", () => {
      app.querySelector("[data-file-import]").click();
    });
  app
    .querySelector("[data-file-import]")
    .addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await importJSONFile(file);
        if (!data.id) data.id = uuid();
        data.updatedAt = Date.now();
        await db.put(data);
        toast("Backup imported");
        route();
      } catch {
        toast("Invalid JSON file", "danger");
      }
    });

  app.querySelector(".dashboard").addEventListener("click", async (e) => {
    const card = e.target.closest("[data-id]");
    if (!card) return;
    const id = card.dataset.id;
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act || act === "open") {
      location.hash = `#editor/${id}`;
      return;
    }
    if (act === "rename") {
      startInlineRename(card, id);
      return;
    }
    if (act === "duplicate") {
      const r = await db.get(id);
      const copy = JSON.parse(JSON.stringify(r));
      copy.id = uuid();
      copy.title = r.title + " (copy)";
      copy.updatedAt = Date.now();
      await db.put(copy);
      toast("Resume duplicated");
      showDashboard();
      return;
    }
    if (act === "delete") {
      const ok = await confirmDialog({
        title: "Delete resume?",
        message: "This resume and all its content will be permanently removed.",
        confirmLabel: "Delete resume",
      });
      if (ok) {
        await db.del(id);
        toast("Resume deleted");
        showDashboard();
      }
    }
  });
}

async function createNewResume() {
  const r = createEmptyResume("Untitled Resume");
  await db.put(JSON.parse(JSON.stringify(r)));
  location.hash = `#editor/${r.id}`;
}

function startInlineRename(card, id) {
  const titleEl = card.querySelector(".card-title");
  if (!titleEl) return;
  const original = titleEl.textContent;
  const input = document.createElement("input");
  input.className = "inline-title-input";
  input.value = original;
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  const commit = async () => {
    const val = input.value.trim() || original;
    const r = await db.get(id);
    if (r) {
      r.title = val;
      r.updatedAt = Date.now();
      await db.put(r);
    }
    toast("Renamed");
    showDashboard();
  };
  const cancel = () => showDashboard();

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  });
  input.addEventListener("blur", commit, { once: true });
}

function resumeCard(r) {
  const date = new Date(r.updatedAt || Date.now());
  const fmt = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `
    <article class="resume-card" data-id="${r.id}">
      <div class="card-main">
        <div class="card-icon">${svgDoc()}</div>
        <div class="card-text">
          <h3 class="card-title" title="Double-click to rename">${escapeHTML(r.title)}</h3>
          <div class="card-meta">Last edited ${fmt}</div>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn btn-secondary btn-sm" data-act="open">Open</button>
        <button class="icon-btn" data-act="rename" aria-label="Rename resume" title="Rename">${svgPencil()}</button>
        <button class="icon-btn" data-act="duplicate" aria-label="Duplicate resume" title="Duplicate">${svgCopy()}</button>
        <button class="icon-btn danger" data-act="delete" aria-label="Delete resume" title="Delete">${svgTrash()}</button>
      </div>
    </article>`;
}

/* ---------------- Editor ---------------- */
let unsubEditor = null;
let previewResizeObserver = null;
let previewScale = 1;

async function openEditor(id) {
  let resume = await db.get(id);
  if (!resume) {
    location.hash = "";
    return;
  }
  resume.settings = { ...DEFAULT_SETTINGS, ...(resume.settings || {}) };

  app.innerHTML = `
    <div class="editor-root">
      ${topBarHTML({ mode: "editor", resume })}
      <div class="editor-layout" data-mobile-tab="edit">
        <aside class="editor-sidebar" data-editor-form></aside>
        <section class="preview-pane">
          <div class="preview-toolbar">
            <div class="segmented" data-mobile-toggle role="tablist" aria-label="View mode">
              <button data-tab="edit" class="active" role="tab" aria-selected="true">Edit</button>
              <button data-tab="preview" role="tab" aria-selected="false">Preview</button>
            </div>
            <button class="ats-badge" data-ats-badge type="button" aria-expanded="false" aria-controls="ats-panel">
              <span data-ats-text>ATS Check</span>
            </button>
          </div>
          <div class="preview-scroll" data-preview-scroll>
            <div class="preview-stage" data-preview-stage>
              <div class="preview-page" data-preview data-paper="A4" data-margins="normal" data-heading-style="uppercase"></div>
            </div>
          </div>
          <aside class="ats-panel hidden" id="ats-panel" data-ats-panel aria-live="polite"></aside>
        </section>
      </div>
    </div>
  `;

  wireTopBar();
  loadResume(resume);

  const formEl = app.querySelector("[data-editor-form]");
  const previewEl = app.querySelector("[data-preview]");
  const stageEl = app.querySelector("[data-preview-stage]");
  const scrollEl = app.querySelector("[data-preview-scroll]");
  const atsPanel = app.querySelector("[data-ats-panel]");
  const atsBadge = app.querySelector("[data-ats-badge]");
  const atsText = app.querySelector("[data-ats-text]");

  renderEditor(formEl, resume, {});

  // Title inline rename in top bar
  const titleBtn = app.querySelector("[data-title-btn]");
  titleBtn.addEventListener("click", () => beginTitleEdit(titleBtn, resume.id));

  // Top bar actions
  app.querySelector('[data-action="back"]').addEventListener("click", () => {
    location.hash = "";
  });
  app
    .querySelector('[data-action="undo"]')
    .addEventListener("click", () => undo());
  app
    .querySelector('[data-action="redo"]')
    .addEventListener("click", () => redo());
  app
    .querySelector('[data-action="download-pdf"]')
    .addEventListener("click", () => {
      exportPDF(getCurrentResume());
      toast("Opening print dialog…");
    });
  app
    .querySelector('[data-action="export-txt"]')
    .addEventListener("click", () => {
      exportTXT(getCurrentResume());
      toast("TXT downloaded");
    });
  app
    .querySelector('[data-action="export-json"]')
    .addEventListener("click", () => {
      exportJSON(getCurrentResume());
      toast("JSON backup downloaded");
    });

  // DnD
  initDnD(formEl, (payload) => {
    mutate((r) => {
      if (payload.type === "section") {
        const from = r.sections.findIndex((s) => s.id === payload.id);
        const to = r.sections.findIndex((s) => s.id === payload.targetId);
        if (from < 0 || to < 0) return;
        const [moved] = r.sections.splice(from, 1);
        r.sections.splice(to, 0, moved);
      } else if (payload.type === "entry") {
        const s = r.sections.find((x) => x.id === payload.parent);
        if (!s) return;
        const from = s.entries.findIndex((x) => x.id === payload.id);
        const to = s.entries.findIndex((x) => x.id === payload.targetId);
        if (from < 0 || to < 0) return;
        const [moved] = s.entries.splice(from, 1);
        s.entries.splice(to, 0, moved);
      }
    });
  });

  // ATS panel toggle
  atsBadge.addEventListener("click", () => {
    const open = atsPanel.classList.toggle("hidden") === false;
    atsBadge.setAttribute("aria-expanded", String(open));
    updateATS();
  });

  // Mobile edit/preview toggle
  app.querySelector("[data-mobile-toggle]").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    app.querySelectorAll("[data-mobile-toggle] button").forEach((b) => {
      const active = b === btn;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", active);
    });
    app.querySelector(".editor-layout").dataset.mobileTab = btn.dataset.tab;
    // Re-scale after switching views (preview may now have width)
    requestAnimationFrame(scalePreview);
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
    const r = getState().currentResume;
    if (!r) return;
    const layout = LAYOUTS[r.settings.layout] || LAYOUTS.classic;
    previewEl.dataset.paper = r.settings.paper;
    previewEl.dataset.margins = r.settings.margins;
    previewEl.dataset.headingStyle = r.settings.headingStyle;
    previewEl.style.setProperty(
      "--font-body",
      `'${r.settings.font}', sans-serif`,
    );
    previewEl.style.setProperty("--fs-base", `${r.settings.baseSize}pt`);
    previewEl.style.setProperty("--lh", r.settings.lineHeight);
    previewEl.style.setProperty(
      "--section-spacing",
      `${r.settings.sectionSpacing}px`,
    );
    previewEl.style.setProperty("--accent", r.settings.accent);
    previewEl.innerHTML = layout.render(r);
    updatePrintPage(r.settings);
    updateUndoButtons();
    updateATS();
    updateTitleBar(r.title);
    scalePreview();
  }

  function updateUndoButtons() {
    app.querySelector('[data-action="undo"]').disabled = !canUndo();
    app.querySelector('[data-action="redo"]').disabled = !canRedo();
  }

  function updateATS() {
    const r = getCurrentResume();
    if (!r) return;
    const pages = estimatePageCount(previewEl);
    atsPanel.innerHTML = renderATSPanel(r, pages);
    const issues = atsPanel.querySelectorAll(".ats-warn").length;
    atsText.textContent = issues > 0 ? `ATS Check · ${issues}` : "ATS Check ✓";
    atsBadge.classList.toggle("warn", issues > 0);
  }

  function updateTitleBar(title) {
    const t = app.querySelector("[data-title-btn]");
    if (t && document.activeElement !== t)
      t.textContent = title || "Untitled Resume";
  }

  /* ---- Scale the A4/Letter page to fit the preview panel width ---- */
  function scalePreview() {
    if (!previewEl || !stageEl || !scrollEl) return;
    // Page dimensions in CSS px (96 dpi) — must match .preview-page CSS
    const pageW =
      previewEl.dataset.paper === "Letter" ? 8.5 * 96 : 210 * (96 / 25.4); // ≈ 793.7 or 816
    const pad = 48; // total horizontal padding inside scroll container
    const available = scrollEl.clientWidth - pad;
    if (available <= 0) return;
    const scale = Math.min(1, available / pageW);
    previewScale = scale;
    previewEl.style.transform = `scale(${scale})`;
    previewEl.style.transformOrigin = "top center";
    // Reserve layout space so the scaled page fits its grid slot
    stageEl.style.width = `${pageW * scale}px`;
    stageEl.style.height = `${previewEl.scrollHeight * scale}px`;
  }

  if (previewResizeObserver) previewResizeObserver.disconnect();
  previewResizeObserver = new ResizeObserver(() => scalePreview());
  previewResizeObserver.observe(scrollEl);
  previewResizeObserver.observe(previewEl);

  unsubEditor && unsubEditor();
  unsubEditor = subscribe((state) => {
    scheduleRender();
    if (!state.currentResume) return;
    const sig = JSON.stringify(
      state.currentResume.sections.map((s) => ({
        id: s.id,
        entries: s.entries.map((e) => e.id),
      })),
    );
    if (formEl.dataset.structureSig !== sig) {
      formEl.dataset.structureSig = sig;
      renderEditor(formEl, state.currentResume, {});
    }
  });

  scheduleRender();
}

function beginTitleEdit(titleBtn, id) {
  const current = titleBtn.textContent;
  const input = document.createElement("input");
  input.className = "title-edit-input";
  input.value = current;
  titleBtn.replaceWith(input);
  input.focus();
  input.select();

  const finish = async (commit) => {
    if (commit) {
      const val = input.value.trim() || "Untitled Resume";
      await db.put(
        Object.assign(await db.get(id), { title: val, updatedAt: Date.now() }),
      );
      toast("Renamed");
      const newBtn = document.createElement("button");
      newBtn.className = "title-btn";
      newBtn.dataset.titleBtn = "";
      newBtn.textContent = val;
      newBtn.addEventListener("click", () => beginTitleEdit(newBtn, id));
      input.replaceWith(newBtn);
      mutate(
        (r) => {
          r.title = val;
        },
        { pushHistory: false },
      );
    } else {
      const newBtn = document.createElement("button");
      newBtn.className = "title-btn";
      newBtn.dataset.titleBtn = "";
      newBtn.textContent = current;
      newBtn.addEventListener("click", () => beginTitleEdit(newBtn, id));
      input.replaceWith(newBtn);
    }
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finish(true);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    }
  });
  input.addEventListener("blur", () => finish(true), { once: true });
}

/* Dynamically update the @page size. */
function updatePrintPage(settings) {
  const styleId = "dynamic-page-style";
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }
  const page = settings.paper === "Letter" ? "letter" : "A4";
  const marginMap = { narrow: "10mm", normal: "16mm", wide: "22mm" };
  const m = marginMap[settings.margins] || "16mm";
  style.textContent = `@page { size: ${page}; margin: ${m}; }`;
}

/* ---------------- Top bar ---------------- */
function topBarHTML({ mode, resume }) {
  const pref = getThemePref();
  const themeLabel =
    pref === "system" ? "System" : pref === "dark" ? "Dark" : "Light";
  const themeIcon =
    pref === "dark" ? svgMoon() : pref === "light" ? svgSun() : svgAuto();

  if (mode === "dashboard") {
    return `
      <header class="top-bar">
        <div class="top-bar-left">
          <a class="brand" href="#" aria-label="Home">
            <span class="brand-mark">ATS</span>
            <span class="brand-name">Resume Builder</span>
          </a>
        </div>
        <div class="top-bar-right">
          <button class="btn btn-secondary btn-sm theme-btn" data-theme-toggle data-theme-pref="${pref}" aria-label="Toggle theme (currently ${themeLabel})">
            <span class="theme-icon">${themeIcon}</span>
            <span data-theme-label>${themeLabel}</span>
          </button>
        </div>
      </header>`;
  }

  return `
    <header class="top-bar">
      <div class="top-bar-left">
        <button class="btn btn-ghost btn-sm" data-action="back" aria-label="Back to dashboard">
          ${svgArrowLeft()}<span>Dashboard</span>
        </button>
        <button class="title-btn" data-title-btn title="Rename resume">${escapeHTML(resume.title || "Untitled Resume")}</button>
        <span class="save-status" data-save-status data-state="saved">Saved</span>
      </div>
      <div class="top-bar-right">
        <button class="btn btn-secondary btn-sm" data-action="undo" aria-label="Undo" title="Undo">${svgUndo()}</button>
        <button class="btn btn-secondary btn-sm" data-action="redo" aria-label="Redo" title="Redo">${svgRedo()}</button>
        <span class="topbar-sep" aria-hidden="true"></span>
        <button class="btn btn-secondary btn-sm" data-action="export-json" title="Export JSON backup">JSON</button>
        <button class="btn btn-secondary btn-sm" data-action="export-txt" title="Export plain text">TXT</button>
        <button class="btn btn-primary btn-sm" data-action="download-pdf">${svgDownload()}<span>Download PDF</span></button>
        <button class="btn btn-secondary btn-sm theme-btn" data-theme-toggle data-theme-pref="${pref}" aria-label="Toggle theme (currently ${themeLabel})">
          <span class="theme-icon">${themeIcon}</span>
          <span data-theme-label>${themeLabel}</span>
        </button>
      </div>
    </header>`;
}

function wireTopBar() {
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cur = getThemePref();
      const order = ["light", "dark", "system"];
      const next = order[(order.indexOf(cur) + 1) % order.length];
      setThemePref(next);
    });
  });
}

/* ---------------- Inline SVG icons ---------------- */
function svgPlus() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
}
function svgDoc() {
  return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';
}
function svgPencil() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
}
function svgCopy() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
}
function svgTrash() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>';
}
function svgUpload() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M6 9l6-6 6 6M4 21h16"/></svg>';
}
function svgArrowLeft() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
}
function svgUndo() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a6 6 0 0 1 0 12h-3"/></svg>';
}
function svgRedo() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H9a6 6 0 0 0 0 12h3"/></svg>';
}
function svgDownload() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M6 9l6 6 6-6M4 21h16"/></svg>';
}
function svgSun() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
}
function svgMoon() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
}
function svgAuto() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/></svg>';
}

/* ---------------- Boot ---------------- */
(async function boot() {
  applyTheme(getThemePref());
  try {
    await cleanupSeed();
  } catch (e) {
    console.warn(e);
  }
  route();
})();
