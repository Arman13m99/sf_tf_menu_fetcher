// static/js/ui/toppingsModal.js
import * as dom from '../dom.js';
import * as state from '../state.js';
import { isProbablyRTL } from '../utils.js';

// Internal helper function to find the current item being edited
function getCurrentEditingSfItem() {
    const itemId = state.getCurrentEditingSFToppingsItemId();
    if (!itemId) return null;
    return state.getSfMenuItemsStore().find(it => it.domId === itemId);
}

function renderToppingItems(toppings, groupDomId) {
    if (!toppings || toppings.length === 0) return '<p class="text-muted small ms-1">No toppings in this group.</p>';
    return toppings.map(t => {
        const tRTL = isProbablyRTL(t.title);
        const dRTL = isProbablyRTL(t.description);
        return `
            <div class="topping-item d-flex align-items-center mb-2 border-bottom pb-1 flex-wrap" id="${t.domId}">
                <div class="form-check me-2 flex-shrink-0"><input class="form-check-input" type="checkbox" ${t.selected ? 'checked' : ''} id="topping-select-${t.domId}" data-group-domid="${groupDomId}" data-topping-domid="${t.domId}" data-field="toppingSelected"></div>
                <input type="text" class="form-control form-control-sm flex-grow-1 me-2 mb-1 ${tRTL ? 'rtl-input' : ''}" value="${t.title || ''}" data-group-domid="${groupDomId}" data-topping-domid="${t.domId}" placeholder="Topping Name" data-field="toppingTitle" style="min-width:100px;">
                <input type="text" class="form-control form-control-sm flex-grow-1 me-2 mb-1 ${dRTL ? 'rtl-input' : ''}" value="${t.description || ''}" data-group-domid="${groupDomId}" data-topping-domid="${t.domId}" placeholder="Desc." data-field="toppingDescription" style="min-width:100px;">
                <div class="input-group input-group-sm mb-1 me-2" style="width:125px;"><span class="input-group-text">ID</span><input type="text" class="form-control form-control-sm topping-id-input" value="${t.originalToppingId || (t.domId.startsWith('topping-new-') ? (t.id || '') : '')}" data-group-domid="${groupDomId}" data-topping-domid="${t.domId}" data-field="toppingId" ${(!t.domId.startsWith('topping-new-') && typeof t.originalToppingId !== 'undefined' && t.originalToppingId !== null) ? 'readonly' : ''} placeholder="Topping ID"></div>
                <div class="input-group input-group-sm ms-auto me-2 mb-1" style="width:120px;"><span class="input-group-text">تومان</span><input type="number" step="any" min="0" class="form-control" value="${t.price || 0}" data-group-domid="${groupDomId}" data-topping-domid="${t.domId}" data-field="toppingPrice"></div>
                <button class="btn btn-sm btn-outline-danger delete-topping-btn mb-1" type="button" data-group-domid="${groupDomId}" data-topping-domid="${t.domId}"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-x" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg></button>
            </div>`;
    }).join('');
}

export function renderToppingsModal(toppingsGroups) {
    dom.toppingsModalBody.innerHTML = '';
    if (!Array.isArray(toppingsGroups) || toppingsGroups.length === 0) {
        dom.toppingsModalBody.innerHTML = '<p class="text-center text-muted">No topping groups. Add one below.</p>';
        return;
    }
    toppingsGroups.forEach(g => {
        const gRTL = isProbablyRTL(g.title);
        const div = document.createElement('div');
        div.className = 'topping-group mb-3 p-3 border rounded bg-light';
        div.id = g.domId;
        div.innerHTML = `
            <div class="topping-group-header d-flex align-items-center flex-wrap mb-2 border-bottom pb-2">
                <div class="form-check me-2"><input class="form-check-input" type="checkbox" ${g.selected ? 'checked' : ''} id="group-select-${g.domId}" data-group-domid="${g.domId}" data-field="groupSelected"><label class="form-check-label small" for="group-select-${g.domId}">Inc</label></div>
                <input type="text" class="form-control form-control-sm group-title-input flex-grow-1 me-2 mb-1 ${gRTL ? 'rtl-input' : ''}" value="${g.title || ''}" data-group-domid="${g.domId}" placeholder="Group Title" data-field="groupTitle" style="min-width:150px;">
                <div class="input-group input-group-sm me-2 mb-1" style="width:150px;"><span class="input-group-text">ID</span><input type="text" class="form-control form-control-sm group-id-input" value="${g.originalGroupId || (g.domId.startsWith('toppinggroup-new-') ? (g.id || '') : '')}" data-group-domid="${g.domId}" data-field="groupId" placeholder="Group ID" ${(!g.domId.startsWith('toppinggroup-new-') && typeof g.originalGroupId !== 'undefined' && g.originalGroupId !== null) ? 'readonly' : ''}></div>
                <div class="input-group input-group-sm me-2 mb-1" style="width:90px;"><span class="input-group-text">Min</span><input type="number" min="0" class="form-control" value="${g.minCount || 0}" data-group-domid="${g.domId}" data-field="groupMinCount"></div>
                <div class="input-group input-group-sm me-2 mb-1" style="width:90px;"><span class="input-group-text">Max</span><input type="number" min="0" class="form-control" value="${g.maxCount === undefined ? 1 : g.maxCount}" data-group-domid="${g.domId}" data-field="groupMaxCount"></div>
                <button class="btn btn-sm btn-outline-danger delete-topping-group-btn ms-auto mb-1" type="button" data-group-domid="${g.domId}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-x-circle" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg></button>
            </div>
            <div class="topping-items-container mt-2 ps-3">${renderToppingItems(g.toppings || [], g.domId)}</div>
            <div class="text-end mt-2"><button class="btn btn-sm btn-outline-info add-topping-to-group-btn" type="button" data-group-domid="${g.domId}">+ Add Topping to Group</button></div>
        `;
        dom.toppingsModalBody.appendChild(div);
    });
}

function updateToppingDataFromModalInput(el, sfItem) {
    const field = el.dataset.field;
    const groupDomId = el.dataset.groupDomid;
    const toppingDomId = el.dataset.toppingDomid;
    let value = el.type === 'checkbox' ? el.checked : el.value;

    if (el.type === 'number') value = parseFloat(value) || 0;

    const group = sfItem.productToppings.find(g => g.domId === groupDomId);
    if (!group) return;

    if (toppingDomId) { // It's a topping field
        const topping = group.toppings.find(t => t.domId === toppingDomId);
        if (!topping) return;
        const keyMap = { toppingSelected: 'selected', toppingTitle: 'title', toppingDescription: 'description', toppingId: 'id', toppingPrice: 'price' };
        if (keyMap[field]) {
            topping[keyMap[field]] = value;
            if (field === 'toppingId' && topping.domId.startsWith('topping-new-')) topping.originalToppingId = null; // New topping ID is not original
        }
        if (field === 'toppingTitle' || field === 'toppingDescription') el.classList.toggle('rtl-input', isProbablyRTL(value));
    } else { // It's a group field
        const keyMap = { groupSelected: 'selected', groupTitle: 'title', groupId: 'id', groupMinCount: 'minCount', groupMaxCount: 'maxCount' };
        if (keyMap[field]) {
            group[keyMap[field]] = value;
            if (field === 'groupId' && group.domId.startsWith('toppinggroup-new-')) group.originalGroupId = null; // New group ID is not original
        }
        if (field === 'groupTitle') el.classList.toggle('rtl-input', isProbablyRTL(value));
    }
}

export function handleToppingsModalClicks(event) {
    const target = event.target;
    const sfItem = getCurrentEditingSfItem();
    if (!sfItem) return;

    const inputChanged = target.closest('[data-field]');
    const deleteGroupBtn = target.closest('.delete-topping-group-btn');
    const addToppingBtn = target.closest('.add-topping-to-group-btn');
    const deleteToppingBtn = target.closest('.delete-topping-btn');

    if (inputChanged) {
        updateToppingDataFromModalInput(inputChanged, sfItem);
    } else if (deleteGroupBtn) {
        const groupDomId = deleteGroupBtn.dataset.groupDomid;
        if (confirm("Delete this topping group and all its toppings?")) {
            sfItem.productToppings = sfItem.productToppings.filter(g => g.domId !== groupDomId);
            renderToppingsModal(sfItem.productToppings); // Re-render the modal body
        }
    } else if (addToppingBtn) {
        const groupDomId = addToppingBtn.dataset.groupDomid;
        const group = sfItem.productToppings.find(g => g.domId === groupDomId);
        if (group) {
            if (!Array.isArray(group.toppings)) group.toppings = [];
            const newToppingDomId = `topping-new-${state.getNextNewToppingId()}`;
            group.toppings.push({ domId: newToppingDomId, id: "", originalToppingId: null, title: "New Topping", description: "", price: 0, selected: true });
            renderToppingsModal(sfItem.productToppings); // Re-render
        }
    } else if (deleteToppingBtn) {
        const groupDomId = deleteToppingBtn.dataset.groupDomid;
        const toppingDomId = deleteToppingBtn.dataset.toppingDomid;
        if (confirm("Delete this topping?")) {
            const group = sfItem.productToppings.find(g => g.domId === groupDomId);
            if (group && group.toppings) {
                group.toppings = group.toppings.filter(t => t.domId !== toppingDomId);
                renderToppingsModal(sfItem.productToppings); // Re-render
            }
        }
    }
}

export function handleAddToppingGroupToModal() {
    const sfItem = getCurrentEditingSfItem();
    if (!sfItem) return;

    if (!Array.isArray(sfItem.productToppings)) sfItem.productToppings = [];
    const newGroupDomId = `toppinggroup-new-${state.getNextNewToppingGroupId()}`;
    sfItem.productToppings.push({ domId: newGroupDomId, id: "", originalGroupId: null, title: "New Group", minCount: 0, maxCount: 1, selected: true, toppings: [] });
    renderToppingsModal(sfItem.productToppings);
}

export function handleConfirmToppings() {
    const sfItem = getCurrentEditingSfItem();
    if (sfItem) {
        // Update the toppings count on the item card in the main UI
        const itemCard = document.getElementById(sfItem.domId);
        if (itemCard) {
            const toppingsBtn = itemCard.querySelector('.item-toppings-btn');
            if (toppingsBtn) {
                toppingsBtn.textContent = `Toppings (${sfItem.productToppings?.filter(g => g.selected).length || 0} Grps)`;
            }
        }
    }
    dom.toppingsModalInstance.hide();
    state.setCurrentEditingSFToppingsItemId(null); // Clear the currently editing item ID
}

// This function will be called from menu.js when an item's toppings button is clicked
export function openToppingsModalForItem(itemId) {
    state.setCurrentEditingSFToppingsItemId(itemId);
    const sfItem = getCurrentEditingSfItem();
    if (!sfItem) {
        console.error("Could not find SF item to open toppings modal for:", itemId);
        return;
    }
    dom.toppingsModalLabel.textContent = `Toppings: ${sfItem.itemTitle || (sfItem.domId.startsWith('item-new-sf-') ? 'New SnappFood Item' : 'Unnamed SnappFood Item')}`;
    dom.toppingsModalLabel.classList.toggle('rtl-input', isProbablyRTL(sfItem.itemTitle));
    renderToppingsModal(sfItem.productToppings);
    dom.toppingsModalInstance.show();
}