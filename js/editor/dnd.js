/**
 * @file Native HTML5 drag-and-drop helpers for reordering sections and entries.
 * Uses data attributes:
 *   data-drag-type="section" | "entry"
 *   data-drag-id="<id>"
 *   data-drag-parent="<sectionId>" (for entries)
 */

let dragState = null;

const dragId = (el) => el.dataset.dragId || el.dataset.entryId;

export function initDnD(container, onReorder) {
  container.addEventListener('dragstart', (e) => {
    const handle = e.target.closest('[draggable="true"][data-drag-type]');
    if (!handle) return;
    dragState = {
      type: handle.dataset.dragType,
      id: dragId(handle),
      parent: handle.dataset.dragParent || null,
    };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragState.id);
    handle.classList.add('dragging');
  });

  container.addEventListener('dragend', (e) => {
    const handle = e.target.closest('[draggable="true"][data-drag-type]');
    if (handle) handle.classList.remove('dragging');
    container.querySelectorAll('.drop-target').forEach(n => n.classList.remove('drop-target'));
    dragState = null;
  });

  container.addEventListener('dragover', (e) => {
    if (!dragState) return;
    const target = e.target.closest('[data-drag-type]');
    if (!target) return;
    if (target.dataset.dragType !== dragState.type) return;
    if (dragId(target) === dragState.id) return; 
    if (dragState.type === 'entry' && target.dataset.dragParent !== dragState.parent) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    container.querySelectorAll('.drop-target').forEach(n => n.classList.remove('drop-target'));
    target.classList.add('drop-target');
  });

  container.addEventListener('drop', (e) => {
    if (!dragState) return;
    const target = e.target.closest('[data-drag-type]');
    if (!target) return;
    if (target.dataset.dragType !== dragState.type) return;
    if (target.dataset.dragId === dragState.id) return;
    if (dragState.type === 'entry' && target.dataset.dragParent !== dragState.parent) return;
    e.preventDefault();
    target.classList.remove('drop-target');
    onReorder({
      type: dragState.type,
      id: dragState.id,
      parent: dragState.parent,
      targetId: dragId(target),
    });
  });
}