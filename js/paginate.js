/**
 * @file Splits the on-screen preview into real pages (A4 / Letter) with a gap between them.
 * Blocks (lines of the header, headings, entry heads, bullets, paragraphs, skill rows)
 * that would cross a page's bottom margin get pushed to the top of the next page,
 * mirroring how pdf.js breaks pages, so preview and download match.
 */

const GAP = 24; // px between sheets
const PAGE_H = { A4: (297 * 96) / 25.4, Letter: 11 * 96 };

// Candidate blocks; only "leaf" candidates (no candidate inside them) are kept
const BLOCKS = [
  '.resume-header > *', 'h1', 'h2', 'h3', 'p', 'li',
  '.entry-head', '.entry-org', '.entry-desc', '.skill-group', '.skills-list',
  '.profile-entry', '.entry',
].join(',');

// Never leave these alone at the bottom of a page
const KEEP_WITH_NEXT = '.section-title, .entry-head, .entry-org';

/** Top of el relative to the page's padding box (transform-independent). */
function topIn(page, el) {
  let y = 0;
  for (let n = el; n && n !== page; n = n.offsetParent) y += n.offsetTop;
  return y;
}

function reset(page) {
  page.querySelectorAll('[data-pushed]').forEach((el) => {
    el.style.marginTop = '';
    delete el.dataset.pushed;
  });
  page.classList.remove('paged');
  page.style.height = '';
  page.style.removeProperty('--page-h');
  page.style.removeProperty('--page-gap');
}

/** Move el's top to exactly `desired` (handles margin collapsing by re-measuring). */
function pushTo(page, el, desired) {
  for (let i = 0; i < 3; i++) {
    const diff = desired - topIn(page, el);
    if (Math.abs(diff) < 0.5) break;
    const mt = parseFloat(getComputedStyle(el).marginTop) || 0;
    el.style.marginTop = `${mt + diff}px`;
  }
  el.dataset.pushed = '1';
}

export function paginate(page) {
  reset(page);
  if (window.matchMedia('(max-width: 900px)').matches) return; // mobile: single flowing sheet

  const P = PAGE_H[page.dataset.paper] || PAGE_H.A4;
  const STEP = P + GAP;
  const cs = getComputedStyle(page);
  const padT = parseFloat(cs.paddingTop) || 0;
  const padB = parseFloat(cs.paddingBottom) || 0;
  const contentH = P - padT - padB;

  page.classList.add('paged'); // position: relative + min-height: 0 (see CSS)
  page.style.setProperty('--page-h', `${P}px`);
  page.style.setProperty('--page-gap', `${GAP}px`);

  const all = [...page.querySelectorAll(BLOCKS)];
  const blocks = all.filter((el) => !el.querySelector(BLOCKS));

  for (let i = 0; i < blocks.length; i++) {
    const el = blocks[i];
    const h = el.offsetHeight;
    if (!h || h > contentH) continue;              // empty, or taller than a page: let it flow

    const t = topIn(page, el);
    const k = Math.floor(t / STEP);
    const contentEnd = k * STEP + P - padB;
    if (t + h <= contentEnd) continue;             // fits on this page

    // Pull headings/titles that sit right above along with this block
    let j = i;
    while (
      j > 0 && i - j < 3 &&
      blocks[j - 1].matches(KEEP_WITH_NEXT) &&
      Math.floor(topIn(page, blocks[j - 1]) / STEP) === k &&
      topIn(page, blocks[j - 1]) > k * STEP + padT + 1   // not already first on the page
    ) j--;

    pushTo(page, blocks[j], (k + 1) * STEP + padT);
    i = j;                                         // re-check from the moved block
  }

  // Size the sheet stack to whole pages
  page.style.height = 'auto';
  const contentBottom = page.scrollHeight - padB;
  const pages = Math.max(1, Math.floor(Math.max(0, contentBottom - 1) / STEP) + 1);
  page.style.height = `${pages * STEP - GAP}px`;
  page.dataset.pages = pages;
}
