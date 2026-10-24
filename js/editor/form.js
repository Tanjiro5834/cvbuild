/**
 * @file Left-side editor form rendering.
 * Renders personal details, sections, entries, and settings.
 */
import { escapeHTML, sanitizeHTML, uuid } from '../utils.js';
import {
  mutate, emptyEntry, emptySection, BUILTIN_SECTIONS, DEFAULT_SETTINGS
} from '../store.js';
import { attachRichText } from './richtext.js';

const FONT_GROUPS = [
  { label: 'Sans-serif', fonts: ['Inter','Roboto','Open Sans','Lato','Source Sans 3','Arial'] },
  { label: 'Serif', fonts: ['Merriweather','EB Garamond','Source Serif 4','Lora','Georgia','Times New Roman'] },
  { label: 'Monospace', fonts: ['JetBrains Mono','IBM Plex Mono','Roboto Mono','Source Code Pro','Courier Prime'] },
];

const LAYOUT_OPTIONS = [
  ['classic', 'Classic'], ['left', 'Left-Aligned'], ['compact', 'Compact'], ['dates-right', 'Dates-Right'],
];

/** Render the entire editor into a container element. */
export function renderEditor(container, resume, handlers) {
  if (!resume) { container.innerHTML = ''; return; }

  container.innerHTML = `
    <div class="editor-tabs" data-tabs>
      <button class="tab active" data-tab="content">Content</button>
      <button class="tab" data-tab="customize">Customize</button>
    </div>

    <div class="editor-pane" data-pane="content">
      ${renderPersonal(resume)}
      <div class="sections-list" data-sections-list>
        ${resume.sections.map((s, i) => renderSection(s, i)).join('')}
      </div>
      ${renderAddSection()}
    </div>

    <div class="editor-pane hidden" data-pane="customize">
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
    <div class="panel">
      <div class="panel-title">Personal details</div>
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
      <div class="custom-links" data-custom-links>
        ${p.customLinks.map((c, i) => `
          <div class="grid-2 link-row" data-link-idx="${i}">
            <input data-personal="customLinks.${i}.label" value="${escapeHTML(c.label)}" placeholder="Label" />
            <input data-personal="customLinks.${i}.url" value="${escapeHTML(c.url)}" placeholder="URL" />
          </div>`).join('')}
      </div>
      <button class="btn-ghost" data-action="add-custom-link">+ Add custom link</button>
    </div>`;
}

function field(key, label, value, type = 'text') {
  return `<label class="field">
    <span>${label}</span>
    <input type="${type}" data-personal="${key}" value="${escapeHTML(value)}" placeholder="${label}" />
  </label>`;
}

/* ---------------- Sections ---------------- */

function renderSection(section, idx) {
  const isSkill = section.type === 'skills';
  return `
    <details class="section-card" data-section-id="${section.id}" open>
      <summary class="section-head" draggable="true" data-drag-type="section" data-drag-id="${section.id}">
        <span class="drag-handle">⋮⋮</span>
        <input class="section-title-input" data-section-title="${section.id}" value="${escapeHTML(section.title)}" />
        <label class="toggle">
          <input type="checkbox" data-section-visible="${section.id}" ${section.hidden ? '' : 'checked'} />
          <span>Show</span>
        </label>
        <button class="btn-icon" title="Delete section" data-action="delete-section" data-id="${section.id}">🗑</button>
      </summary>
      <div class="section-body">
        ${section.type === 'profile'
          ? renderProfileEntry(section)
          : isSkill
            ? renderSkillEntries(section)
            : section.entries.map(e => renderEntry(e, section)).join('')}
        <button class="btn-ghost" data-action="add-entry" data-section="${section.id}">
          + Add ${isSkill ? 'skill' : 'entry'}
        </button>
      </div>
    </details>`;
}

function renderProfileEntry(section) {
  const entry = section.entries[0] || emptyEntry('profile');
  return `
    <div class="entry-card" data-entry-id="${entry.id}" data-entry-parent="${section.id}"
         draggable="false">
      <div class="rt-wrap">
        <div class="editable" contenteditable="true"
             data-entry-desc="${section.id}:${entry.id}">${sanitizeHTML(entry.description)}</div>
      </div>
    </div>`;
}

function renderSkillEntries(section) {
  return section.entries.map(entry => `
    <div class="entry-card skill-entry" data-entry-id="${entry.id}" data-entry-parent="${section.id}"
         draggable="true" data-drag-type="entry" data-drag-parent="${section.id}">
      <div class="entry-head">
        <span class="drag-handle">⋮⋮</span>
        <input data-entry-field="title" data-section="${section.id}" data-entry="${entry.id}"
               value="${escapeHTML(entry.title)}" placeholder="Skill (e.g. JavaScript, Node.js)" />
        <label class="toggle">
          <input type="checkbox" data-entry-visible="${section.id}:${entry.id}" ${entry.hidden ? '' : 'checked'} />
          <span>Show</span>
        </label>
        <button class="btn-icon" data-action="delete-entry" data-section="${section.id}" data-entry="${entry.id}">🗑</button>
      </div>
    </div>`).join('');
}

function renderEntry(entry, section) {
  const sid = section.id;
  return `
    <div class="entry-card" data-entry-id="${entry.id}" data-entry-parent="${sid}"
         draggable="true" data-drag-type="entry" data-drag-parent="${sid}">
      <div class="entry-head">
        <span class="drag-handle">⋮⋮</span>
        <label class="toggle">
          <input type="checkbox" data-entry-visible="${sid}:${entry.id}" ${entry.hidden ? '' : 'checked'} />
          <span>Show</span>
        </label>
        <button class="btn-icon" data-action="delete-entry" data-section="${sid}" data-entry="${entry.id}">🗑</button>
      </div>
      <div class="grid-2">
        <input data-entry-field="title" data-section="${sid}" data-entry="${entry.id}"
               value="${escapeHTML(entry.title)}" placeholder="Title / Role" />
        <input data-entry-field="organization" data-section="${sid}" data-entry="${entry.id}"
               value="${escapeHTML(entry.organization)}" placeholder="Organization" />
        <input data-entry-field="location" data-section="${sid}" data-entry="${entry.id}"
               value="${escapeHTML(entry.location)}" placeholder="Location" />
        <div class="date-row">
          <input type="month" data-entry-field="start" data-section="${sid}" data-entry="${entry.id}"
                 value="${escapeHTML(entry.start)}" />
          <input type="month" data-entry-field="end" data-section="${sid}" data-entry="${entry.id}"
                 value="${escapeHTML(entry.end)}" ${entry.present ? 'disabled' : ''} />
          <label class="toggle small">
            <input type="checkbox" data-entry-present="${sid}:${entry.id}" ${entry.present ? 'checked' : ''} />
            <span>Present</span>
          </label>
        </div>
      </div>
      <div class="rt-wrap">
        <div class="editable" contenteditable="true"
             data-entry-desc="${sid}:${entry.id}">${sanitizeHTML(entry.description)}</div>
      </div>
    </div>`;
}

function renderAddSection() {
  const opts = BUILTIN_SECTIONS.map(s => `<option value="${s.type}">${s.title}</option>`).join('');
  return `
    <div class="panel add-section">
      <div class="panel-title">Add section</div>
      <div class="add-section-row">
        <select data-add-section-type>
          ${opts}
          <option value="custom">Custom section…</option>
        </select>
        <button class="btn-primary" data-action="add-section">Add</button>
      </div>
    </div>`;
}

/* ---------------- Customize ---------------- */

function renderCustomize(resume) {
  const s = resume.settings || DEFAULT_SETTINGS;
  const fontOptions = FONT_GROUPS.map(g => `
    <optgroup label="${g.label}">
      ${g.fonts.map(f => `<option value="${f}" style="font-family:'${f}',sans-serif" ${s.font === f ? 'selected' : ''}>${f}</option>`).join('')}
    </optgroup>`).join('');

  return `
    <div class="panel">
      <div class="panel-title">Layout</div>
      <div class="layout-grid">
        ${LAYOUT_OPTIONS.map(([v, label]) => `
          <button class="layout-btn ${s.layout === v ? 'active' : ''}" data-layout="${v}">
            <div class="layout-thumb layout-thumb-${v}"></div>
            <span>${label}</span>
          </button>`).join('')}
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">Typography</div>
      <label class="field">
        <span>Font</span>
        <select data-setting="font">${fontOptions}</select>
      </label>
      <label class="field">
        <span>Base font size: <b data-display="baseSize">${s.baseSize}</b>pt</span>
        <input type="range" min="9" max="12" step="0.5" value="${s.baseSize}" data-setting="baseSize" />
      </label>
      <label class="field">
        <span>Line height: <b data-display="lineHeight">${s.lineHeight}</b></span>
        <input type="range" min="1.1" max="1.8" step="0.05" value="${s.lineHeight}" data-setting="lineHeight" />
      </label>
      <label class="field">
        <span>Section spacing: <b data-display="sectionSpacing">${s.sectionSpacing}</b>px</span>
        <input type="range" min="6" max="28" step="1" value="${s.sectionSpacing}" data-setting="sectionSpacing" />
      </label>
    </div>

    <div class="panel">
      <div class="panel-title">Page</div>
      <label class="field">
        <span>Margins</span>
        <select data-setting="margins">
          <option value="narrow" ${s.margins==='narrow'?'selected':''}>Narrow</option>
          <option value="normal" ${s.margins==='normal'?'selected':''}>Normal</option>
          <option value="wide" ${s.margins==='wide'?'selected':''}>Wide</option>
        </select>
      </label>
      <label class="field">
        <span>Paper size</span>
        <select data-setting="paper">
          <option value="A4" ${s.paper==='A4'?'selected':''}>A4</option>
          <option value="Letter" ${s.paper==='Letter'?'selected':''}>US Letter</option>
        </select>
      </label>
    </div>

    <div class="panel">
      <div class="panel-title">Accent & format</div>
      <label class="field">
        <span>Accent color</span>
        <input type="color" data-setting="accent" value="${s.accent}" />
      </label>
      <label class="field">
        <span>Date format</span>
        <select data-setting="dateFormat">
          <option value="MMM YYYY" ${s.dateFormat==='MMM YYYY'?'selected':''}>MMM YYYY</option>
          <option value="MM/YYYY" ${s.dateFormat==='MM/YYYY'?'selected':''}>MM/YYYY</option>
          <option value="YYYY" ${s.dateFormat==='YYYY'?'selected':''}>YYYY</option>
        </select>
      </label>
      <label class="field">
        <span>Heading style</span>
        <select data-setting="headingStyle">
          <option value="uppercase" ${s.headingStyle==='uppercase'?'selected':''}>Uppercase</option>
          <option value="bold" ${s.headingStyle==='bold'?'selected':''}>Bold</option>
          <option value="underline" ${s.headingStyle==='underline'?'selected':''}>Underline divider</option>
        </select>
      </label>
    </div>
  `;
}

/* ---------------- Handlers ---------------- */

function attachTabs(container) {
  const tabs = container.querySelector('[data-tabs]');
  if (!tabs) return;
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    tabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === btn));
    const pane = btn.dataset.tab;
    container.querySelectorAll('[data-pane]').forEach(p => {
      p.classList.toggle('hidden', p.dataset.pane !== pane);
    });
  });
}

function attachContentHandlers(container) {
  // Personal field edits
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
    if (et) {
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
      return;
    }
  });

  // Checkboxes (show/hide)
  container.addEventListener('change', (e) => {
    const sv = e.target.closest('[data-section-visible]');
    if (sv) {
      const sid = sv.dataset.sectionVisible;
      mutate(r => {
        const s = r.sections.find(x => x.id === sid);
        if (s) s.hidden = !sv.checked;
      });
      return;
    }
    const ev = e.target.closest('[data-entry-visible]');
    if (ev) {
      const [sid, eid] = ev.dataset.entryVisible.split(':');
      mutate(r => {
        const s = r.sections.find(x => x.id === sid);
        const en = s && s.entries.find(x => x.id === eid);
        if (en) en.hidden = !ev.checked;
      });
      return;
    }
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

  // Buttons
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
      mutate(r => {
        r.personal.customLinks.push({ label: '', url: '' });
      });
      return;
    }

    if (action === 'delete-section') {
      const id = btn.dataset.id;
      if (!confirm('Delete this section?')) return;
      mutate(r => {
        r.sections = r.sections.filter(s => s.id !== id);
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
      if (!confirm('Delete this entry?')) return;
      mutate(r => {
        const s = r.sections.find(x => x.id === section);
        if (s) s.entries = s.entries.filter(en => en.id !== entry);
      });
      return;
    }
  });

  // Attach rich-text editors after render
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
    if (key === 'font' || key === 'layout') val = String(val);

    mutate(r => {
      r.settings[key] = val;
    });

    // Update numeric displays
    const disp = container.querySelector(`[data-display="${key}"]`);
    if (disp) disp.textContent = val;
  });

  container.addEventListener('click', (e) => {
    const lb = e.target.closest('[data-layout]');
    if (lb) {
      const val = lb.dataset.layout;
      mutate(r => { r.settings.layout = val; });
      container.querySelectorAll('[data-layout]').forEach(b => b.classList.toggle('active', b === lb));
    }
  });
}