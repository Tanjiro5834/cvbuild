/**
 * @file Left-side editor form rendering.
 * Rewritten entry form: labeled fields, CSS-Grid rows, Month/Year selects,
 * toggle switch for "Present", clickable collapsed header with summary.
 */
import {
  escapeHTML, sanitizeHTML, dateToParts, partsToDate, yearOptions,
  formatDate, MONTHS,
} from '../utils.js';
import {
  mutate, emptyEntry, emptySection, BUILTIN_SECTIONS, DEFAULT_SETTINGS
} from '../store.js';
import { attachRichText } from './richtext.js';

/* ---------------- Icons ---------------- */

const ICONS = {
  drag: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>',
  eye: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.4 4.2M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7a10.9 10.9 0 0 0 4.1-.8"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>',
  chevron: '<svg class="chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
};

/* ---------------- Fonts & layouts ---------------- */

const FONT_GROUPS = [
  { label: 'Sans-serif', fonts: ['Inter','Roboto','Open Sans','Lato','Source Sans 3','Arial'] },
  { label: 'Serif', fonts: ['Merriweather','EB Garamond','Source Serif 4','Lora','Georgia','Times New Roman'] },
  { label: 'Monospace', fonts: ['JetBrains Mono','IBM Plex Mono','Roboto Mono','Source Code Pro','Courier Prime'] },
];

const LAYOUT_OPTIONS = [
  ['classic', 'Classic'], ['left', 'Left-Aligned'], ['compact', 'Compact'], ['dates-right', 'Dates-Right'],
];

/* ---------------- Entry point ---------------- */

/** Render the entire editor into a container element. */
export function renderEditor(container, resume, handlers) {
  if (!resume) { container.innerHTML = ''; return; }

  const activeTab = container.dataset.tab || 'content';

  container.innerHTML = `
    <div class="editor-tabs" role="tablist" data-tabs>
      <button role="tab" class="tab ${activeTab === 'content' ? 'active' : ''}" data-tab="content" aria-selected="${activeTab === 'content'}">Content</button>
      <button role="tab" class="tab ${activeTab === 'customize' ? 'active' : ''}" data-tab="customize" aria-selected="${activeTab === 'customize'}">Customize</button>
    </div>

    <div class="editor-pane ${activeTab !== 'content' ? 'hidden' : ''}" data-pane="content">
      ${renderPersonal(resume)}
      <div class="sections-list" data-sections-list>
        ${resume.sections.length === 0
          ? `<div class="empty-sections">No sections yet. Add one below.</div>`
          : resume.sections.map(s => renderSection(s, resume.settings)).join('')}
      </div>
      ${renderAddSection()}
    </div>

    <div class="editor-pane ${activeTab !== 'customize' ? 'hidden' : ''}" data-pane="customize">
      ${renderCustomize(resume)}
    </div>
  `;

  attachContentHandlers(container);
  attachCustomizeHandlers(container);
  attachTabs(container);
  handlers.onAfterRender && handlers.onAfterRender();
}

/* ---------------- Personal ---------------- */

function renderPersonal(resume) {
  const p = resume.personal;
  return `
    <section class="panel">
      <header class="panel-head"><h3>Personal details</h3></header>
      <div class="grid-2">
        ${field('fullName', 'Full name', p.fullName)}
        ${field('jobTitle', 'Job title', p.jobTitle)}
        ${field('email', 'Email', p.email, 'email')}
        ${field('phone', 'Phone', p.phone, 'tel')}
        ${field('location', 'Location', p.location)}
        ${field('website', 'Website', p.website)}
        ${field('linkedin', 'LinkedIn', p.linkedin)}
        ${field('github', 'GitHub', p.github)}
      </div>
      ${p.customLinks.length ? `
        <div class="custom-links" data-custom-links>
          ${p.customLinks.map((c, i) => `
            <div class="grid-2 link-row" data-link-idx="${i}">
              <label class="field">
                <span class="field-label">Label</span>
                <input data-personal="customLinks.${i}.label" value="${escapeHTML(c.label)}" placeholder="e.g. Portfolio" />
              </label>
              <label class="field">
                <span class="field-label">URL</span>
                <input data-personal="customLinks.${i}.url" value="${escapeHTML(c.url)}" placeholder="https://…" />
              </label>
            </div>`).join('')}
        </div>` : ''}
      <button type="button" class="btn btn-secondary btn-sm" data-action="add-custom-link">
        ${ICONS.plus}<span>Add custom link</span>
      </button>
    </section>`;
}

function field(key, label, value, type = 'text') {
  const id = `field-${key}`;
  return `<label class="field" for="${id}">
    <span class="field-label">${label}</span>
    <input id="${id}" type="${type}" data-personal="${key}" value="${escapeHTML(value)}" placeholder="${label}" />
  </label>`;
}

/* ---------------- Section ---------------- */

function renderSection(section, settings) {
  const isSkill = section.type === 'skills';
  const isProfile = section.type === 'profile';
  const hidden = section.hidden;
  const entryLabel = isSkill ? 'skill' : 'entry';

  return `
    <article class="section-card" data-section-id="${section.id}">
      <header class="section-head" draggable="true" data-drag-type="section" data-drag-id="${section.id}">
        <span class="drag-handle" aria-hidden="true" title="Drag to reorder">${ICONS.drag}</span>
        <input class="section-title-input" data-section-title="${section.id}" value="${escapeHTML(section.title)}" aria-label="Section title" />
        <button type="button" class="icon-btn ${hidden ? 'muted' : ''}" data-action="toggle-section" data-id="${section.id}" aria-label="${hidden ? 'Show' : 'Hide'} section" title="${hidden ? 'Show' : 'Hide'} section">
          ${hidden ? ICONS.eyeOff : ICONS.eye}
        </button>
        <button type="button" class="icon-btn danger" data-action="delete-section" data-id="${section.id}" aria-label="Delete section" title="Delete section">
          ${ICONS.trash}
        </button>
        <button type="button" class="icon-btn" data-action="toggle-collapse-section" data-id="${section.id}" aria-label="Collapse section" title="Collapse section">
          ${ICONS.chevron}
        </button>
      </header>
      <div class="section-body">
        ${isProfile
          ? renderProfileEntry(section)
          : isSkill
            ? renderSkillEntries(section)
            : (section.entries.length === 0
                ? `<div class="empty-entries">Add your first ${entryLabel}.</div>`
                : section.entries.map(e => renderEntry(e, section, settings)).join(''))}
        <button type="button" class="btn btn-secondary btn-sm add-entry" data-action="add-entry" data-section="${section.id}">
          ${ICONS.plus}<span>Add ${entryLabel}</span>
        </button>
      </div>
    </article>`;
}

function renderProfileEntry(section) {
  const entry = section.entries[0] || emptyEntry('profile');
  return `
    <div class="entry-card" data-entry-id="${entry.id}" data-entry-parent="${section.id}">
      <div class="rt-wrap">
        <div class="editable" contenteditable="true"
             data-entry-desc="${section.id}:${entry.id}"
             aria-label="Profile summary">${sanitizeHTML(entry.description)}</div>
      </div>
    </div>`;
}

function renderSkillEntries(section) {
  return section.entries.map(entry => `
    <div class="entry-card skill-entry" data-entry-id="${entry.id}" data-entry-parent="${section.id}"
         draggable="true" data-drag-type="entry" data-drag-parent="${section.id}">
      <div class="entry-head">
        <span class="drag-handle" aria-hidden="true">${ICONS.drag}</span>
        <input data-entry-field="title" data-section="${section.id}" data-entry="${entry.id}"
               value="${escapeHTML(entry.title)}" placeholder="Skill (e.g. JavaScript)" aria-label="Skill" />
        <button type="button" class="icon-btn ${entry.hidden ? 'muted' : ''}" data-action="toggle-entry" data-section="${section.id}" data-entry="${entry.id}" aria-label="${entry.hidden ? 'Show' : 'Hide'} skill">
          ${entry.hidden ? ICONS.eyeOff : ICONS.eye}
        </button>
        <button type="button" class="icon-btn danger" data-action="delete-entry" data-section="${section.id}" data-entry="${entry.id}" aria-label="Delete skill">
          ${ICONS.trash}
        </button>
      </div>
    </div>`).join('');
}

/* Summary line for collapsed entry header */
function entrySummary(section, entry, settings) {
  if (section.type === 'skills' || section.type === 'profile') return '';
  const title = entry.title || '';
  const org = entry.organization || '';
  const start = entry.start ? formatDate(entry.start, settings.dateFormat || 'MMM YYYY') : '';
  const end = entry.present
    ? 'Present'
    : entry.end ? formatDate(entry.end, settings.dateFormat || 'MMM YYYY') : '';
  const dates = start && end ? `${start} – ${end}` : start || end;
  const bits = [title, org, dates].filter(Boolean);
  return bits.join(' · ');
}

function dateSelectHTML({ field, sectionId, entryId, value, disabled, ariaLabel }) {
  const { month, year } = dateToParts(value);
  const years = yearOptions();
  const monthOpts = [
    `<option value="">Month</option>`,
    ...MONTHS.map((m, i) => {
      const v = String(i + 1).padStart(2, '0');
      return `<option value="${v}" ${month === v ? 'selected' : ''}>${m}</option>`;
    }),
  ].join('');
  const yearOpts = [
    `<option value="">Year</option>`,
    ...years.map(y => `<option value="${y}" ${year === y ? 'selected' : ''}>${y}</option>`),
  ].join('');
  return `
    <div class="date-split">
      <select class="date-month"
              data-date-month
              data-entry-field="${field}"
              data-section="${sectionId}" data-entry="${entryId}"
              aria-label="${ariaLabel} — month"
              ${disabled ? 'disabled' : ''}>${monthOpts}</select>
      <select class="date-year"
              data-date-year
              data-entry-field="${field}"
              data-section="${sectionId}" data-entry="${entryId}"
              aria-label="${ariaLabel} — year"
              ${disabled ? 'disabled' : ''}>${yearOpts}</select>
    </div>`;
}

function renderEntry(entry, section, settings) {
  const sid = section.id;
  const eid = entry.id;
  const collapsed = !!entry._collapsed;
  const summary = entrySummary(section, entry, settings) || '';
  const summaryIsEmpty = !summary;

  return `
    <article class="entry-card ${collapsed ? 'collapsed' : ''}"
             data-entry-id="${eid}" data-entry-parent="${sid}"
             draggable="true" data-drag-type="entry" data-drag-parent="${sid}">
      <header class="entry-head" data-entry-header>
        <span class="drag-handle" aria-hidden="true" title="Drag to reorder">${ICONS.drag}</span>
        <button type="button" class="entry-summary-btn" data-action="toggle-collapse-entry" data-section="${sid}" data-entry="${eid}" aria-label="Toggle entry details">
          ${summaryIsEmpty
            ? `<span class="entry-summary muted">Untitled entry</span>`
            : `<span class="entry-summary">${escapeHTML(summary)}</span>`}
        </button>
        <button type="button" class="icon-btn ${entry.hidden ? 'muted' : ''}" data-action="toggle-entry" data-section="${sid}" data-entry="${eid}" aria-label="${entry.hidden ? 'Show' : 'Hide'} entry">
          ${entry.hidden ? ICONS.eyeOff : ICONS.eye}
        </button>
        <button type="button" class="icon-btn danger" data-action="delete-entry" data-section="${sid}" data-entry="${eid}" aria-label="Delete entry">
          ${ICONS.trash}
        </button>
        <button type="button" class="icon-btn" data-action="toggle-collapse-entry" data-section="${sid}" data-entry="${eid}" aria-label="Collapse entry">
          ${ICONS.chevron}
        </button>
      </header>

      <div class="entry-body">
        <div class="entry-grid">
          <div class="field-cell">
            <label class="field-label" for="e-${eid}-title">Title</label>
            <input id="e-${eid}-title" data-entry-field="title" data-section="${sid}" data-entry="${eid}"
                   value="${escapeHTML(entry.title)}" placeholder="Job title / Role" />
          </div>
          <div class="field-cell">
            <label class="field-label" for="e-${eid}-org">Organization</label>
            <input id="e-${eid}-org" data-entry-field="organization" data-section="${sid}" data-entry="${eid}"
                   value="${escapeHTML(entry.organization)}" placeholder="Company / School / Project" />
          </div>

          <div class="field-cell field-full">
            <label class="field-label" for="e-${eid}-loc">Location</label>
            <input id="e-${eid}-loc" data-entry-field="location" data-section="${sid}" data-entry="${eid}"
                   value="${escapeHTML(entry.location)}" placeholder="City, Country or Remote" />
          </div>

          <div class="field-cell">
            <label class="field-label" for="e-${eid}-start-month">Start date</label>
            ${dateSelectHTML({ field: 'start', sectionId: sid, entryId: eid, value: entry.start, disabled: false, ariaLabel: 'Start date' })}
          </div>
          <div class="field-cell">
            <label class="field-label" for="e-${eid}-end-month">End date</label>
            ${dateSelectHTML({ field: 'end', sectionId: sid, entryId: eid, value: entry.end, disabled: entry.present, ariaLabel: 'End date' })}
          </div>

          <div class="field-cell field-full">
            <label class="switch">
              <input type="checkbox" data-entry-present="${sid}:${eid}" ${entry.present ? 'checked' : ''} />
              <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
              <span class="switch-label">Currently working here</span>
            </label>
          </div>

          <div class="field-cell field-full">
            <label class="field-label">Description</label>
            <div class="rt-wrap">
              <div class="editable" contenteditable="true"
                   data-entry-desc="${sid}:${eid}"
                   aria-label="Description">${sanitizeHTML(entry.description)}</div>
            </div>
          </div>
        </div>
      </div>
    </article>`;
}

function renderAddSection() {
  const opts = BUILTIN_SECTIONS.map(s => `<option value="${s.type}">${s.title}</option>`).join('');
  return `
    <section class="panel add-section">
      <header class="panel-head"><h3>Add section</h3></header>
      <div class="add-section-row">
        <select data-add-section-type aria-label="Section type">
          ${opts}
          <option value="custom">Custom section…</option>
        </select>
        <button type="button" class="btn btn-primary" data-action="add-section">Add</button>
      </div>
    </section>`;
}

/* ---------------- Customize ---------------- */

function renderCustomize(resume) {
  const s = resume.settings || DEFAULT_SETTINGS;
  const fontOptions = FONT_GROUPS.map(g => `
    <optgroup label="${g.label}">
      ${g.fonts.map(f => `<option value="${f}" style="font-family:'${f}',sans-serif" ${s.font === f ? 'selected' : ''}>${f}</option>`).join('')}
    </optgroup>`).join('');

  return `
    <section class="panel">
      <header class="panel-head"><h3>Layout</h3></header>
      <div class="layout-grid">
        ${LAYOUT_OPTIONS.map(([v, label]) => `
          <button type="button" class="layout-btn ${s.layout === v ? 'active' : ''}" data-layout="${v}" aria-pressed="${s.layout === v}">
            <div class="layout-thumb layout-thumb-${v}"></div>
            <span>${label}</span>
          </button>`).join('')}
      </div>
    </section>

    <section class="panel">
      <header class="panel-head"><h3>Typography</h3></header>
      <label class="field">
        <span class="field-label">Font</span>
        <select data-setting="font">${fontOptions}</select>
      </label>
      <label class="field">
        <span class="field-label">Base font size: <b data-display="baseSize">${s.baseSize}</b>pt</span>
        <input type="range" min="9" max="12" step="0.5" value="${s.baseSize}" data-setting="baseSize" />
      </label>
      <label class="field">
        <span class="field-label">Line height: <b data-display="lineHeight">${s.lineHeight}</b></span>
        <input type="range" min="1.1" max="1.8" step="0.05" value="${s.lineHeight}" data-setting="lineHeight" />
      </label>
      <label class="field">
        <span class="field-label">Section spacing: <b data-display="sectionSpacing">${s.sectionSpacing}</b>px</span>
        <input type="range" min="6" max="28" step="1" value="${s.sectionSpacing}" data-setting="sectionSpacing" />
      </label>
    </section>

    <section class="panel">
      <header class="panel-head"><h3>Page</h3></header>
      <label class="field">
        <span class="field-label">Margins</span>
        <select data-setting="margins">
          <option value="narrow" ${s.margins==='narrow'?'selected':''}>Narrow</option>
          <option value="normal" ${s.margins==='normal'?'selected':''}>Normal</option>
          <option value="wide" ${s.margins==='wide'?'selected':''}>Wide</option>
        </select>
      </label>
      <label class="field">
        <span class="field-label">Paper size</span>
        <select data-setting="paper">
          <option value="A4" ${s.paper==='A4'?'selected':''}>A4</option>
          <option value="Letter" ${s.paper==='Letter'?'selected':''}>US Letter</option>
        </select>
      </label>
    </section>

    <section class="panel">
      <header class="panel-head"><h3>Accent &amp; format</h3></header>
      <label class="field">
        <span class="field-label">Accent color</span>
        <input type="color" data-setting="accent" value="${s.accent}" />
      </label>
      <label class="field">
        <span class="field-label">Date format</span>
        <select data-setting="dateFormat">
          <option value="MMM YYYY" ${s.dateFormat==='MMM YYYY'?'selected':''}>MMM YYYY</option>
          <option value="MM/YYYY" ${s.dateFormat==='MM/YYYY'?'selected':''}>MM/YYYY</option>
          <option value="YYYY" ${s.dateFormat==='YYYY'?'selected':''}>YYYY</option>
        </select>
      </label>
      <label class="field">
        <span class="field-label">Heading style</span>
        <select data-setting="headingStyle">
          <option value="uppercase" ${s.headingStyle==='uppercase'?'selected':''}>Uppercase</option>
          <option value="bold" ${s.headingStyle==='bold'?'selected':''}>Bold</option>
          <option value="underline" ${s.headingStyle==='underline'?'selected':''}>Underline divider</option>
        </select>
      </label>
    </section>
  `;
}

/* ---------------- Handlers ---------------- */

function attachTabs(container) {
  const tabs = container.querySelector('[data-tabs]');
  if (!tabs) return;
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    const tab = btn.dataset.tab;
    container.dataset.tab = tab;
    tabs.querySelectorAll('.tab').forEach(t => {
      const active = t === btn;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active);
    });
    container.querySelectorAll('[data-pane]').forEach(p => {
      p.classList.toggle('hidden', p.dataset.pane !== tab);
    });
  });
}

function attachContentHandlers(container) {
  // Input edits (delegated)
  container.addEventListener('input', (e) => {
    const inp = e.target.closest('[data-personal]');
    if (inp) {
      const path = inp.dataset.personal.split('.');
      mutate(r => {
        let obj = r.personal;
        for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
        obj[path[path.length - 1]] = inp.value;
      });
      return;
    }
    const et = e.target.closest('[data-entry-field]');
    if (et && et.tagName === 'INPUT') {
      const { section, entry } = et.dataset;
      const field = et.dataset.entryField;
      mutate(r => {
        const s = r.sections.find(x => x.id === section);
        const en = s && s.entries.find(x => x.id === entry);
        if (en) en[field] = et.value;
      });
      return;
    }
    const st = e.target.closest('[data-section-title]');
    if (st) {
      const sid = st.dataset.sectionTitle;
      mutate(r => {
        const s = r.sections.find(x => x.id === sid);
        if (s) s.title = st.value;
      });
    }
  });

  // Selects (date parts + present checkbox)
  container.addEventListener('change', (e) => {
    // Date part selects
    const monthSel = e.target.closest('[data-date-month]');
    const yearSel = e.target.closest('[data-date-year]');
    if (monthSel || yearSel) {
      const sel = monthSel || yearSel;
      const { section, entry } = sel.dataset;
      const field = sel.dataset.entryField; // 'start' | 'end'
      const card = sel.closest('.entry-card');
      const monthInput = card.querySelector(`[data-date-month][data-entry-field="${field}"]`);
      const yearInput = card.querySelector(`[data-date-year][data-entry-field="${field}"]`);
      const month = monthInput ? monthInput.value : '';
      const year = yearInput ? yearInput.value : '';
      const stored = partsToDate(month, year);
      mutate(r => {
        const s = r.sections.find(x => x.id === section);
        const en = s && s.entries.find(x => x.id === entry);
        if (en) en[field] = stored;
      });
      return;
    }

    // Present toggle
    const ep = e.target.closest('[data-entry-present]');
    if (ep) {
      const [sid, eid] = ep.dataset.entryPresent.split(':');
      mutate(r => {
        const s = r.sections.find(x => x.id === sid);
        const en = s && s.entries.find(x => x.id === eid);
        if (en) {
          en.present = ep.checked;
          if (ep.checked) en.end = '';
        }
      });
      return;
    }
  });

  // Clicks
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'add-section') {
      const sel = container.querySelector('[data-add-section-type]');
      const type = sel.value;
      mutate(r => {
        if (type === 'custom') {
          const title = prompt('Section title?', 'Custom Section');
          if (!title) return;
          r.sections.push(emptySection('custom', title));
        } else {
          const meta = BUILTIN_SECTIONS.find(b => b.type === type);
          const exists = r.sections.find(s => s.type === type);
          if (exists) { alert('Section already exists.'); return; }
          const sec = emptySection(type, meta.title);
          if (type === 'profile') sec.entries.push(emptyEntry('profile'));
          r.sections.push(sec);
        }
      });
      return;
    }

    if (action === 'add-custom-link') {
      mutate(r => { r.personal.customLinks.push({ label: '', url: '' }); });
      return;
    }

    if (action === 'delete-section') {
      const id = btn.dataset.id;
      const title = container.querySelector(`[data-section-title="${id}"]`)?.value || 'this section';
      window.__confirmDelete?.({
        title: 'Delete section?',
        message: `“${title}” and all its entries will be permanently removed.`,
        onConfirm: () => mutate(r => { r.sections = r.sections.filter(s => s.id !== id); }),
      });
      return;
    }

    if (action === 'add-entry') {
      const sid = btn.dataset.section;
      mutate(r => {
        const s = r.sections.find(x => x.id === sid);
        if (s) s.entries.push(emptyEntry(s.type));
      });
      return;
    }

    if (action === 'delete-entry') {
      const { section, entry } = btn.dataset;
      window.__confirmDelete?.({
        title: 'Delete entry?',
        message: 'This entry will be permanently removed.',
        onConfirm: () => mutate(r => {
          const s = r.sections.find(x => x.id === section);
          if (s) s.entries = s.entries.filter(en => en.id !== entry);
        }),
      });
      return;
    }

    if (action === 'toggle-section') {
      const id = btn.dataset.id;
      mutate(r => {
        const s = r.sections.find(x => x.id === id);
        if (s) s.hidden = !s.hidden;
      });
      return;
    }

    if (action === 'toggle-entry') {
      const { section, entry } = btn.dataset;
      mutate(r => {
        const s = r.sections.find(x => x.id === section);
        const en = s && s.entries.find(x => x.id === entry);
        if (en) en.hidden = !en.hidden;
      });
      return;
    }

    if (action === 'toggle-collapse-section') {
      const card = btn.closest('.section-card');
      card?.classList.toggle('collapsed');
      return;
    }

    if (action === 'toggle-collapse-entry') {
      const card = btn.closest('.entry-card');
      if (!card) return;
      const collapsed = card.classList.toggle('collapsed');
      const sid = card.dataset.entryParent;
      const eid = card.dataset.entryId;
      mutate(r => {
        const s = r.sections.find(x => x.id === sid);
        const en = s && s.entries.find(x => x.id === eid);
        if (en) en._collapsed = collapsed;
      }, { pushHistory: false });
      return;
    }
  });

  // Click on the whole entry header toggles collapse (excluding interactive controls)
  container.addEventListener('click', (e) => {
    const head = e.target.closest('[data-entry-header]');
    if (!head) return;
    if (e.target.closest('button, input, select, a')) return;
    const card = head.closest('.entry-card');
    if (!card) return;
    const collapsed = card.classList.toggle('collapsed');
    const sid = card.dataset.entryParent;
    const eid = card.dataset.entryId;
    mutate(r => {
      const s = r.sections.find(x => x.id === sid);
      const en = s && s.entries.find(x => x.id === eid);
      if (en) en._collapsed = collapsed;
    }, { pushHistory: false });
  });

  // Rich text
  container.querySelectorAll('[data-entry-desc]').forEach(el => {
    const [sid, eid] = el.dataset.entryDesc.split(':');
    attachRichText(el, (html) => {
      mutate(r => {
        const s = r.sections.find(x => x.id === sid);
        const en = s && s.entries.find(x => x.id === eid);
        if (en) en.description = html;
      }, { pushHistory: false });
    });
  });
}

function attachCustomizeHandlers(container) {
  container.addEventListener('input', (e) => {
    const setting = e.target.closest('[data-setting]');
    if (!setting) return;
    const key = setting.dataset.setting;
    let val = setting.value;
    if (['baseSize','lineHeight','sectionSpacing'].includes(key)) val = parseFloat(val);

    mutate(r => { r.settings[key] = val; });

    const disp = container.querySelector(`[data-display="${key}"]`);
    if (disp) disp.textContent = val;
  });

  container.addEventListener('click', (e) => {
    const lb = e.target.closest('[data-layout]');
    if (lb) {
      const val = lb.dataset.layout;
      mutate(r => { r.settings.layout = val; });
      container.querySelectorAll('[data-layout]').forEach(b => {
        const active = b === lb;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active);
      });
    }
  });
}