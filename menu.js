// static/js/ui/menu.js
import * as dom from '../dom.js';
import * as state from '../state.js';
import { isProbablyRTL, convertTagsInputToJSON } from '../utils.js';
import { getVendorInfoFromForm } from './vendorInfo.js';
import { openToppingsModalForItem } from './toppingsModal.js'; // For item card's toppings button

// --- Helper Functions to access platform-specific DOM elements more easily ---
function getMenuItemsContainer(platform) {
    return platform === 'sf' ? dom.sfMenuItemsContainer : dom.tfMenuItemsContainer;
}
function getCategoryQuickNavContainer(platform) {
    return platform === 'sf' ? dom.sfCategoryQuickNav : dom.tfCategoryQuickNav;
}
function getGenerateButton(platform) {
    return platform === 'sf' ? dom.sfGenerateButton : dom.tfGenerateButton;
}
// --- End Helper Functions ---


function createMenuItemCard(item) {
    const platform = item.platform;
    const card = document.createElement('div');
    card.className = 'item-card mb-3 p-3 border rounded shadow-sm';
    card.id = item.domId;

    const titleRTL = isProbablyRTL(item.itemTitle);
    const descRTL = isProbablyRTL(item.description);
    const hasToppingsButton = platform === 'sf';

    card.innerHTML = `
        <div class="row align-items-center mb-2 g-2">
            <div class="col"><input type="text" class="form-control form-control-sm item-title-input ${titleRTL ? 'rtl-input' : ''}" value="${item.itemTitle || ''}" data-field="itemTitle" placeholder="Item Name"></div>
            <div class="col-auto item-id-display text-muted small">${item.itemId ? `ID: ${item.itemId}` : (item.domId.startsWith(`item-new-${platform}-`) ? `<span class="badge bg-info text-dark">New</span>` : '')}</div>
            <div class="col-auto"><input class="form-check-input item-select-checkbox" type="checkbox" ${item.selected ? 'checked' : ''} data-field="selected" title="Include Item"></div>
            <div class="col-auto"><button class="btn btn-sm btn-outline-danger delete-item-btn" type="button" title="Delete Item"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16"><path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/></svg></button></div>
        </div>
        <textarea class="form-control form-control-sm item-description-textarea mb-2 ${descRTL ? 'rtl-input' : ''}" data-field="description" placeholder="Description...">${item.description || ''}</textarea>
        <div class="item-controls d-flex justify-content-between align-items-center">
            ${hasToppingsButton ? `<button class="btn btn-sm btn-outline-secondary item-toppings-btn" type="button" aria-label="Manage Toppings">Toppings (${item.productToppings?.filter(g => g.selected).length || 0} Grps)</button>` : '<div class="text-muted small" style="min-width:80px;">(No Toppings)</div>' }
            <div class="d-flex align-items-center">
                <div class="input-group input-group-sm item-price-input-group ms-2" style="width:120px;"><span class="input-group-text">تومان</span><input type="number" step="any" min="0" class="form-control" value="${item.price || 0}" data-field="price" aria-label="Price"></div>
                <div class="input-group input-group-sm item-rating-input-group ms-2" style="width:90px;"><span class="input-group-text" title="Item Rating">⭐</span><input type="number" step="0.1" min="0" max="5" class="form-control" value="${item.rating || 0}" data-field="rating" title="Item Rating (0-5)" aria-label="Item Rating"></div>
            </div>
        </div>`;

    card.querySelector('.delete-item-btn').addEventListener('click', () => {
        if (confirm(`Delete "${item.itemTitle || 'new item'}" from ${platform.toUpperCase()}?`)) {
            const items = state.getMenuItemsStore(platform);
            const itemIndex = items.findIndex(it => it.domId === item.domId);
            if (itemIndex > -1) items.splice(itemIndex, 1);
            renderMenuItems(platform); // Re-render to reflect deletion and possibly remove category
        }
    });

    card.querySelectorAll('input[data-field], textarea[data-field]').forEach(el => {
        el.addEventListener('change', (e) => {
            const field = e.target.dataset.field;
            let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
            const storeItem = state.getMenuItemsStore(platform).find(i => i.domId === item.domId);
            if (!storeItem) return;
            if (e.target.type === 'number') value = parseFloat(value) || 0;
            storeItem[field] = value;
            if (field === 'itemTitle' || field === 'description') {
                el.classList.toggle('rtl-input', isProbablyRTL(value));
            }
        });
    });

    if (hasToppingsButton) {
        card.querySelector('.item-toppings-btn').addEventListener('click', () => {
            openToppingsModalForItem(item.domId); // Use the exported function
        });
    }
    return card;
}


function renderCategoryHeaderDOM(platform, categoryName, addBtn = true) {
    const slug = categoryName.replace(/\s+/g, '-').toLowerCase();
    const sectionId = `category-section-${platform}-${slug}`;

    const section = document.createElement('div');
    section.id = sectionId;
    section.className = 'category-section mb-4';
    if (state.getCollapsedCategoriesSet(platform).has(sectionId)) {
        section.classList.add('collapsed');
    }

    const header = document.createElement('h4');
    header.className = 'category-header pb-2 mb-0 d-flex justify-content-between align-items-center';

    const toggle = document.createElement('span');
    toggle.className = 'category-toggle-icon';
    toggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-caret-down-fill" viewBox="0 0 16 16"><path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/></svg>`;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'flex-grow-1';
    titleSpan.textContent = categoryName;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'd-flex align-items-center flex-grow-1';
    contentDiv.append(toggle, titleSpan);
    header.appendChild(contentDiv);

    if (isProbablyRTL(categoryName)) {
        header.classList.add('rtl-text');
        contentDiv.style.flexDirection = 'row-reverse';
    }

    if (addBtn) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn btn-sm ${platform === 'sf' ? 'btn-snappfood-outline' : 'btn-tapsifood-outline'} add-item-to-category-btn ms-2`;
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-plus-lg" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/></svg> Add Item`;
        btn.dataset.category = categoryName;
        btn.dataset.platform = platform;
        header.appendChild(btn);
    }
    section.appendChild(header);
    const itemsCont = document.createElement('div');
    itemsCont.className = 'items-in-category-container pt-2';
    section.appendChild(itemsCont);

    return section;
}


function populateCategoryQuickNav(platform, categoryNames) {
    const quickNavContainer = getCategoryQuickNavContainer(platform);
    if (!quickNavContainer) return;
    quickNavContainer.innerHTML = '';

    if (categoryNames.length === 0) {
        quickNavContainer.innerHTML = '<span class="text-muted small p-1">No categories loaded.</span>';
        return;
    }

    categoryNames.forEach(catName => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn category-quick-nav-button';
        btn.textContent = catName;
        const sectionId = `category-section-${platform}-${catName.replace(/\s+/g, '-').toLowerCase()}`;
        btn.dataset.targetSectionId = sectionId;

        btn.addEventListener('click', () => {
            const targetSection = document.getElementById(sectionId);
            const menuScrollContainer = getMenuItemsContainer(platform);
            if (targetSection && menuScrollContainer) {
                const navHeight = quickNavContainer.offsetHeight; // Use the actual container here
                const scrollTop = targetSection.offsetTop - menuScrollContainer.offsetTop - navHeight - 5;

                menuScrollContainer.scrollTo({
                    top: scrollTop,
                    behavior: 'smooth'
                });

                if (targetSection.classList.contains('collapsed')) {
                    targetSection.classList.remove('collapsed');
                    state.getCollapsedCategoriesSet(platform).delete(sectionId);
                }
            } else {
                console.warn("Target section or scroll container not found for quick nav:", sectionId);
            }
        });
        quickNavContainer.appendChild(btn);
    });
}

export function renderMenuItems(platform) {
    const container = getMenuItemsContainer(platform);
    // Clear existing category sections but preserve initial-message div if it exists and needed
    container.querySelectorAll('.category-section').forEach(section => section.remove());
    let initialMessageDiv = container.querySelector('.initial-message'); // Check if it exists

    const items = state.getMenuItemsStore(platform);
    const generateBtn = getGenerateButton(platform);

    let allCategoryNamesSet = new Set(items.map(item => item.categoryName || "Uncategorized"));
    state.getManuallyAddedCategoriesSet(platform).forEach(catName => allCategoryNamesSet.add(catName));
    const sortedCategoryNames = Array.from(allCategoryNamesSet).sort();

    if (sortedCategoryNames.length === 0 && items.length === 0) {
        if (initialMessageDiv) {
            initialMessageDiv.innerHTML = `<h5>No menu items or categories for ${platform.toUpperCase()}.</h5><p class="text-muted">Load data or add categories.</p>`;
            initialMessageDiv.style.display = 'block';
        } else {
             container.innerHTML = `<div class="text-center p-5 initial-message">
                <h5>No menu items or categories for ${platform.toUpperCase()}.</h5>
                <p class="text-muted">Load data or add categories.</p>
            </div>`;
        }
        populateCategoryQuickNav(platform, []);
        if (generateBtn) generateBtn.disabled = true;
        return;
    }

    if (initialMessageDiv) initialMessageDiv.style.display = 'none';
    if (generateBtn) generateBtn.disabled = (items.length === 0 && sortedCategoryNames.length === 0);

    const itemsGroupedByCategory = items.reduce((acc, item) => {
        const key = item.categoryName || "Uncategorized";
        (acc[key] = acc[key] || []).push(item);
        return acc;
    }, {});

    populateCategoryQuickNav(platform, sortedCategoryNames);

    sortedCategoryNames.forEach(catName => {
        let section = renderCategoryHeaderDOM(platform, catName, true);
        if (!section) {
            console.error(`Failed to render category header DOM for ${catName} on platform ${platform}`);
            return;
        }
        container.appendChild(section);

        const itemsInCategoryContainer = section.querySelector('.items-in-category-container');
        const itemsForThisCategory = itemsGroupedByCategory[catName] || [];
        if (itemsForThisCategory.length > 0) {
            itemsForThisCategory.forEach(item => {
                const card = createMenuItemCard(item);
                itemsInCategoryContainer.appendChild(card);
            });
        } else {
            itemsInCategoryContainer.innerHTML = '<p class="text-muted small ps-2">No items in this category.</p>';
        }
    });
}

function handleAddItemToCategory(platform, categoryName) {
    const domId = `item-new-${platform}-${state.getNextNewItemId(platform)}`;
    const currentVendorInfo = getVendorInfoFromForm(platform); // from vendorInfo.js
    const currentVendorHeaders = state.getVendorDataStore(platform).originalHeaders || [];

    let newItemOriginalRowData = {};
    if (currentVendorHeaders.length > 0) {
        newItemOriginalRowData = Object.fromEntries(currentVendorHeaders.map(h => [h, '']));
    } else {
        const defaultCols = ['vendor_code', 'vendor_name', 'category_name', 'item_id', 'item_title', 'description', 'price', 'rating', 'product_toppings', 'shifts', 'business_line', 'marketing_area', 'address', 'min_order', 'latitude', 'longitude'];
        if (platform === 'sf') {
            defaultCols.push('snappfood_vendor_id', 'vendor_branch', 'vendor_chain', 'tag_names', 'is_express', 'is_pro', 'is_economical');
        }
         defaultCols.forEach(col => newItemOriginalRowData[col] = '');
    }

    newItemOriginalRowData = { ...newItemOriginalRowData, ...currentVendorInfo };
    newItemOriginalRowData.category_name = categoryName;
    newItemOriginalRowData.price = "0";
    newItemOriginalRowData.rating = "0";
    newItemOriginalRowData.shifts = JSON.stringify(currentVendorInfo.shifts || []);
    if (platform === 'sf') {
        newItemOriginalRowData.tag_names = convertTagsInputToJSON(currentVendorInfo.tag_names || "");
        newItemOriginalRowData.product_toppings = "[]";
    } else {
        newItemOriginalRowData.product_toppings = "[]";
        if(newItemOriginalRowData.hasOwnProperty('item_description')) newItemOriginalRowData.item_description = "";
    }

    const item = {
        domId, selected: true, itemId: null, itemTitle: "",
        description: "", price: 0, rating: 0, categoryName: categoryName,
        productToppings: [],
        originalRowData: newItemOriginalRowData,
        platform: platform
    };

    state.getMenuItemsStore(platform).push(item);
    renderMenuItems(platform); // Full re-render for consistency

    setTimeout(() => {
        const newCard = document.getElementById(domId);
        if (newCard) {
             const catSectionOfNewItem = newCard.closest('.category-section');
             if (catSectionOfNewItem && catSectionOfNewItem.classList.contains('collapsed')) {
                catSectionOfNewItem.classList.remove('collapsed');
                state.getCollapsedCategoriesSet(platform).delete(catSectionOfNewItem.id);
             }
            newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            newCard.querySelector('.item-title-input')?.focus();
        }
    }, 100);

    const genButton = getGenerateButton(platform);
    if (genButton) genButton.disabled = false;
}

export function handleAddNewCategory(platform) {
    const name = prompt(`New ${platform.toUpperCase()} category name:`);
    if (!name || name.trim() === "") {
        if (name !== null) alert("Category name cannot be empty.");
        return;
    }
    const trimName = name.trim();

    const items = state.getMenuItemsStore(platform);
    const existingInItems = items.some(item => item.categoryName === trimName);
    const existingManually = state.getManuallyAddedCategoriesSet(platform).has(trimName);

    if (existingInItems || existingManually) {
        alert(`Category "${trimName}" already exists for ${platform.toUpperCase()}.`);
        return;
    }

    state.getManuallyAddedCategoriesSet(platform).add(trimName);
    renderMenuItems(platform);

    const generateBtn = getGenerateButton(platform);
    if (generateBtn && generateBtn.disabled && (items.length > 0 || state.getManuallyAddedCategoriesSet(platform).size > 0)) {
        generateBtn.disabled = false;
    }
}

export function setupMenuEventListeners(platform) {
    const container = getMenuItemsContainer(platform);
    if (!container) return;

    container.addEventListener('click', function(event) {
        // Handle "Add Item to Category" button
        const addItemBtn = event.target.closest('.add-item-to-category-btn');
        if (addItemBtn && addItemBtn.dataset.platform === platform) {
            const categoryName = addItemBtn.dataset.category;
            if (categoryName) {
                handleAddItemToCategory(platform, categoryName);
            }
            return;
        }

        // Handle category collapse/expand toggle
        const categoryHeader = event.target.closest('.category-header');
        // Ensure the click is on the header itself or its toggle icon, not on buttons inside it like "Add Item"
        if (categoryHeader && !event.target.closest('button')) {
            const categorySection = categoryHeader.parentElement;
            if (categorySection && categorySection.classList.contains('category-section')) {
                categorySection.classList.toggle('collapsed');
                const collapsedSet = state.getCollapsedCategoriesSet(platform);
                if (categorySection.classList.contains('collapsed')) {
                    collapsedSet.add(categorySection.id);
                } else {
                    collapsedSet.delete(categorySection.id);
                }
            }
        }
    });
}