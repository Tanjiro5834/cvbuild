/**
 * @file Central state store with subscribe/notify and undo/redo.
 *
 * Data model:
 * @typedef {Object} Entry
 * @property {string} id
 * @property {string} title
 * @property {string} organization
 * @property {string} location
 * @property {string} start
 * @property {string} end
 * @property {boolean} present
 * @property {string} description   // sanitized HTML
 * @property {boolean} hidden
 *
 * @typedef {Object} Section
 * @property {string} id
 * @property {string} type          // 'profile' | 'experience' | ... | 'custom'
 * @property {string} title
 * @property {Entry[]} entries
 * @property {boolean} hidden
 *
 * @typedef {Object} Settings
 * @property {string} layout        // classic | left | compact | dates-right
 * @property {string} font
 * @property {number} baseSize
 * @property {number} lineHeight
 * @property {number} sectionSpacing
 * @property {'narrow'|'normal'|'wide'} margins
 * @property {'A4'|'Letter'} paper
 * @property {string} accent
 * @property {'MMM YYYY'|'MM/YYYY'|'YYYY'} dateFormat
 * @property {'uppercase'|'bold'|'underline'} headingStyle
 *
 * @typedef {Object} Resume
 * @property {string} id
 * @property {string} title
 * @property {number} updatedAt
 * @property {Object} personal
 * @property {Section[]} sections
 * @property {Settings} settings
 */

import { sanitizeHTML, uuid } from './utils.js';

const listeners = new Set();
const HISTORY_LIMIT = 50;

let state = {
  currentResume: null,   // Resume object or null
  dirty: false,
  history: [],
  historyIndex: -1,
};

function snapshot(resume) {
  return JSON.stringify(resume);
}

function notify() {
  for (const fn of listeners) fn(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

export function getCurrentResume() {
  return state.currentResume;
}

/** Load a resume into the store (resets history). */
export function loadResume(resume) {
  state.currentResume = resume;
  state.history = [snapshot(resume)];
  state.historyIndex = 0;
  state.dirty = false;
  notify();
}

/** Close the editor. */
export function clearResume() {
  state.currentResume = null;
  state.history = [];
  state.historyIndex = -1;
  state.dirty = false;
  notify();
}

/**
 * Apply a mutation to the current resume and push onto the undo stack.
 * @param {(resume: Resume) => void} mutator
 * @param {Object} [opts]
 * @param {boolean} [opts.pushHistory=true]
 */
export function mutate(mutator, opts = {}) {
  const { pushHistory = true } = opts;
  if (!state.currentResume) return;
  mutator(state.currentResume);
  state.currentResume.updatedAt = Date.now();
  state.dirty = true;

  if (pushHistory) {
    const snap = snapshot(state.currentResume);
    // Drop redo tail
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(snap);
    if (state.history.length > HISTORY_LIMIT) state.history.shift();
    state.historyIndex = state.history.length - 1;
  }
  notify();
}

/** Replace whole state (used by undo/redo and import). */
export function _replaceFromHistory(snap) {
  state.currentResume = JSON.parse(snap);
  state.dirty = true;
  notify();
}

export function undo() {
  if (state.historyIndex <= 0) return;
  state.historyIndex--;
  _replaceFromHistory(state.history[state.historyIndex]);
}

export function redo() {
  if (state.historyIndex >= state.history.length - 1) return;
  state.historyIndex++;
  _replaceFromHistory(state.history[state.historyIndex]);
}

export function canUndo() {
  return state.historyIndex > 0;
}
export function canRedo() {
  return state.historyIndex < state.history.length - 1;
}

/* ---------- Resume factory ---------- */

export const DEFAULT_SETTINGS = /** @type {Settings} */ ({
  layout: 'classic',
  font: 'Inter',
  baseSize: 10.5,
  lineHeight: 1.4,
  sectionSpacing: 14,
  margins: 'normal',
  paper: 'A4',
  accent: '#000000',
  dateFormat: 'MMM YYYY',
  headingStyle: 'uppercase',
});

export const BUILTIN_SECTIONS = [
  { type: 'profile', title: 'Profile', singular: false },
  { type: 'experience', title: 'Experience', singular: false },
  { type: 'education', title: 'Education', singular: false },
  { type: 'skills', title: 'Skills', singular: false },
  { type: 'projects', title: 'Projects', singular: false },
  { type: 'certifications', title: 'Certifications', singular: false },
  { type: 'awards', title: 'Awards', singular: false },
  { type: 'languages', title: 'Languages', singular: false },
  { type: 'volunteering', title: 'Volunteering', singular: false },
  { type: 'references', title: 'References', singular: false },
];

export function emptyEntry(type = 'experience') {
  const base = {
    id: uuid(),
    title: '',
    organization: '',
    location: '',
    start: '',
    end: '',
    present: false,
    description: '',
    hidden: false,
  };
  if (type === 'skills') {
    base.organization = ''; // not used
    base.location = '';
  }
  if (type === 'profile') {
    base.title = '';
    base.organization = '';
    base.location = '';
  }
  return base;
}

export function emptySection(type, title) {
  return {
    id: uuid(),
    type,
    title,
    entries: [],
    hidden: false,
  };
}

/** Create a fresh empty resume. */
export function createEmptyResume(title = 'Untitled Resume') {
  return {
    id: uuid(),
    title,
    updatedAt: Date.now(),
    personal: {
      fullName: '',
      jobTitle: '',
      email: '',
      phone: '',
      location: '',
      website: '',
      linkedin: '',
      github: '',
      customLinks: [],
    },
    sections: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}