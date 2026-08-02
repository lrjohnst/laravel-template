(() => {
    const csrf = document.querySelector('meta[name="csrf-token"]').content;
    const container = document.getElementById('todo-container');
    const listId = container.dataset.listId;
    const newInput = document.getElementById('new-item-input');
    const notesPanel = document.getElementById('notes-panel');
    const notesTextarea = document.getElementById('notes-textarea');
    const notesPanelClose = document.getElementById('notes-panel-close');
    const notesPanelHeader = notesPanel.querySelector('.notes-panel-header');
    let activeNotesItemId = null;

    function api(url, method, body) {
        return fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf, 'Accept': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        }).then(r => r.json());
    }

    // --- Create new item on Enter ---
    newInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const title = newInput.value.trim();
            if (!title) return;
            newInput.value = '';
            api(`/lijsten/${listId}/items`, 'POST', { title }).then(item => {
                container.insertAdjacentHTML('beforeend', renderItem(item, 0));
                newInput.focus();
            });
        }
    });

    // --- Inline title editing: save on Enter, indent/outdent on Tab ---
    container.addEventListener('keydown', e => {
        const titleEl = e.target.closest('.todo-title');
        if (!titleEl) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            const itemEl = titleEl.closest('.todo-item');
            const title = titleEl.textContent.trim();
            if (title) {
                api(`/items/${itemEl.dataset.id}`, 'PUT', { title });
            }
            const parentId = itemEl.dataset.parentId || null;
            const depth = getDepth(itemEl);
            api(`/lijsten/${listId}/items`, 'POST', { title: '', parent_id: parentId }).then(item => {
                const html = renderItem(item, depth);
                const nextSibling = findNextSiblingOrParent(itemEl);
                if (nextSibling) {
                    nextSibling.insertAdjacentHTML('beforebegin', html);
                } else {
                    container.insertAdjacentHTML('beforeend', html);
                }
                const newEl = container.querySelector(`[data-id="${item.id}"]`);
                newEl.querySelector('.todo-title').focus();
            });
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            const itemEl = titleEl.closest('.todo-item');
            const itemId = itemEl.dataset.id;
            const currentDepth = getDepth(itemEl);

            if (e.shiftKey) {
                const currentParentId = itemEl.dataset.parentId || null;
                if (!currentParentId) return;
                const parentEl = container.querySelector(`[data-id="${currentParentId}"]`);
                const grandParentId = parentEl ? (parentEl.dataset.parentId || null) : null;
                const newDepth = currentDepth - 1;
                api(`/items/${itemId}`, 'PUT', { parent_id: grandParentId }).then(updated => {
                    itemEl.dataset.parentId = updated.parent_id || '';
                    itemEl.style.paddingLeft = (newDepth * 28) + 'px';
                    if (parentEl) {
                        const afterParent = findNextSiblingOrParent(parentEl);
                        if (afterParent) {
                            container.insertBefore(itemEl, afterParent);
                        } else {
                            container.appendChild(itemEl);
                        }
                    }
                });
            } else {
                const prev = findPrevSibling(itemEl);
                if (!prev) return;
                const newParentId = prev.dataset.id;
                const newDepth = currentDepth + 1;
                api(`/items/${itemId}`, 'PUT', { parent_id: parseInt(newParentId) }).then(updated => {
                    itemEl.dataset.parentId = updated.parent_id || '';
                    itemEl.style.paddingLeft = (newDepth * 28) + 'px';
                });
            }
        }
    });

    // --- Save title on blur ---
    container.addEventListener('focusout', e => {
        const titleEl = e.target.closest('.todo-title');
        if (!titleEl) return;
        const itemEl = titleEl.closest('.todo-item');
        const title = titleEl.textContent.trim();
        if (!title) {
            api(`/items/${itemEl.dataset.id}`, 'DELETE');
            removeItemWithChildren(itemEl);
            return;
        }
        api(`/items/${itemEl.dataset.id}`, 'PUT', { title });
    });

    // --- Checkbox toggle ---
    container.addEventListener('change', e => {
        if (!e.target.classList.contains('todo-check')) return;
        const itemEl = e.target.closest('.todo-item');
        const isDone = e.target.checked;
        api(`/items/${itemEl.dataset.id}`, 'PUT', { is_done: isDone });
        itemEl.classList.toggle('done', isDone);
    });

    // --- Delete button & Notes button ---
    container.addEventListener('click', e => {
        const btn = e.target.closest('.todo-delete');
        if (btn) {
            const itemEl = btn.closest('.todo-item');
            removeItemWithChildren(itemEl);
            api(`/items/${itemEl.dataset.id}`, 'DELETE');
            return;
        }
        const notesBtn = e.target.closest('.todo-notes-btn');
        if (notesBtn) {
            const itemEl = notesBtn.closest('.todo-item');
            openNotesPanel(itemEl);
            return;
        }
    });

    // --- Notes panel (draggable, positioned near item) ---
    function openNotesPanel(itemEl) {
        const itemId = itemEl.dataset.id;
        if (activeNotesItemId === itemId && notesPanel.style.display !== 'none') {
            closeNotesPanel();
            return;
        }
        activeNotesItemId = itemId;
        notesTextarea.value = itemEl.dataset.notes || '';
        notesPanel.style.display = '';

        // Position near the todo item
        const rect = itemEl.getBoundingClientRect();
        const panelWidth = 320;
        const panelHeight = 200;
        let top = rect.bottom + 4;
        let left = rect.right - panelWidth;
        // Keep on screen
        if (left < 8) left = 8;
        if (top + panelHeight > window.innerHeight) top = rect.top - panelHeight - 4;
        notesPanel.style.top = top + 'px';
        notesPanel.style.left = left + 'px';
        notesPanel.style.bottom = 'auto';
        notesPanel.style.right = 'auto';

        notesTextarea.focus();
    }

    function closeNotesPanel() {
        if (activeNotesItemId) saveNotes();
        notesPanel.style.display = 'none';
        activeNotesItemId = null;
    }

    function saveNotes() {
        if (!activeNotesItemId) return;
        const notes = notesTextarea.value.trim() || null;
        const itemEl = container.querySelector(`[data-id="${activeNotesItemId}"]`);
        if (itemEl) {
            itemEl.dataset.notes = notes || '';
            const btn = itemEl.querySelector('.todo-notes-btn');
            btn.classList.toggle('has-notes', !!notes);
        }
        api(`/items/${activeNotesItemId}`, 'PUT', { notes });
    }

    notesPanelClose.addEventListener('click', closeNotesPanel);

    notesTextarea.addEventListener('blur', () => {
        setTimeout(() => {
            if (!notesPanel.contains(document.activeElement)) {
                saveNotes();
            }
        }, 100);
    });

    // --- Sync panel width when textarea is resized ---
    new ResizeObserver(() => {
        const tw = notesTextarea.offsetWidth;
        if (tw > 280) notesPanel.style.width = tw + 'px';
    }).observe(notesTextarea);

    // --- Draggable notes panel ---
    let isDraggingPanel = false, panelDragOffsetX = 0, panelDragOffsetY = 0;
    notesPanelHeader.addEventListener('mousedown', e => {
        if (e.target === notesPanelClose || notesPanelClose.contains(e.target)) return;
        isDraggingPanel = true;
        panelDragOffsetX = e.clientX - notesPanel.getBoundingClientRect().left;
        panelDragOffsetY = e.clientY - notesPanel.getBoundingClientRect().top;
        notesPanelHeader.style.cursor = 'grabbing';
        e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
        if (!isDraggingPanel) return;
        let x = e.clientX - panelDragOffsetX;
        let y = e.clientY - panelDragOffsetY;
        x = Math.max(0, Math.min(x, window.innerWidth - notesPanel.offsetWidth));
        y = Math.max(0, Math.min(y, window.innerHeight - notesPanel.offsetHeight));
        notesPanel.style.left = x + 'px';
        notesPanel.style.top = y + 'px';
    });
    document.addEventListener('mouseup', () => {
        if (isDraggingPanel) {
            isDraggingPanel = false;
            notesPanelHeader.style.cursor = '';
        }
    });

    // --- Drag & drop (handle-initiated, parent drags children) ---
    let dragEl = null;
    let dragChildren = [];

    container.addEventListener('mousedown', e => {
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;
        const item = handle.closest('.todo-item');
        if (item) item.setAttribute('draggable', 'true');
    });

    container.addEventListener('dragstart', e => {
        const item = e.target.closest('.todo-item');
        if (!item) return;
        dragEl = item;
        dragChildren = getDescendantEls(item);
        item.classList.add('dragging');
        dragChildren.forEach(c => c.classList.add('dragging'));
        e.dataTransfer.effectAllowed = 'move';
    });

    container.addEventListener('dragend', e => {
        if (dragEl) {
            dragEl.classList.remove('dragging');
            dragEl.removeAttribute('draggable');
            dragChildren.forEach(c => c.classList.remove('dragging'));
        }
        dragEl = null;
        dragChildren = [];
        saveOrder();
    });

    container.addEventListener('dragover', e => {
        e.preventDefault();
        if (!dragEl) return;
        const target = e.target.closest('.todo-item');
        if (!target || target === dragEl || dragChildren.includes(target)) return;
        const rect = target.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
            container.insertBefore(dragEl, target);
        } else {
            container.insertBefore(dragEl, target.nextSibling);
        }
        let after = dragEl;
        dragChildren.forEach(c => { after.after(c); after = c; });
    });

    function getDescendantEls(itemEl) {
        const descendants = [];
        const collectChildren = (parentId) => {
            container.querySelectorAll(`[data-parent-id="${parentId}"]`).forEach(child => {
                descendants.push(child);
                collectChildren(child.dataset.id);
            });
        };
        collectChildren(itemEl.dataset.id);
        return descendants;
    }

    function saveOrder() {
        const items = [];
        container.querySelectorAll('.todo-item').forEach((el, i) => {
            items.push({
                id: parseInt(el.dataset.id),
                sort_order: i,
                parent_id: el.dataset.parentId ? parseInt(el.dataset.parentId) : null,
            });
        });
        api(`/lijsten/${listId}/reorder`, 'POST', { items });
    }

    function removeItemWithChildren(itemEl) {
        getDescendantEls(itemEl).forEach(c => c.remove());
        itemEl.remove();
    }

    // --- List title editing ---
    const listTitle = document.querySelector('.list-title');
    if (listTitle) {
        listTitle.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); listTitle.blur(); }
        });
        listTitle.addEventListener('blur', () => {
            const name = listTitle.textContent.trim();
            if (name) api(`/lijsten/${listTitle.dataset.listId}`, 'PUT', { name });
        });
    }

    // --- Helpers ---
    function renderItem(item, depth) {
        const checked = item.is_done ? 'checked' : '';
        const pad = depth * 28;
        const notes = item.notes || '';
        const hasNotes = notes ? 'has-notes' : '';
        return `<div class="todo-item" data-id="${item.id}" data-parent-id="${item.parent_id || ''}" data-notes="${escAttr(notes)}" style="padding-left:${pad}px;">
            <span class="drag-handle">&#10303;</span>
            <input type="checkbox" class="todo-check" ${checked}>
            <span class="todo-title" contenteditable="true" data-id="${item.id}">${escHtml(item.title)}</span>
            <span class="todo-actions">
                <button type="button" class="todo-notes-btn ${hasNotes}" title="Notities">&#128196;</button>
                <button class="todo-delete" title="Verwijderen">&times;</button>
            </span>
        </div>`;
    }

    function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function escAttr(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
    function getDepth(el) { return Math.round(parseInt(el.style.paddingLeft || '0') / 28); }

    function findPrevSibling(el) {
        const depth = getDepth(el);
        let prev = el.previousElementSibling;
        while (prev) {
            if (prev.classList.contains('todo-item') && getDepth(prev) === depth) return prev;
            if (prev.classList.contains('todo-item') && getDepth(prev) < depth) return null;
            prev = prev.previousElementSibling;
        }
        return null;
    }

    function findNextSiblingOrParent(el) {
        let next = el.nextElementSibling;
        const depth = getDepth(el);
        while (next && getDepth(next) > depth) next = next.nextElementSibling;
        return next;
    }

    // Mark done items on load
    container.querySelectorAll('.todo-item').forEach(el => {
        if (el.querySelector('.todo-check')?.checked) el.classList.add('done');
    });
})();
