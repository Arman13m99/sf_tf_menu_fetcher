// static/js/state.js

// --- GLOBAL DATA STORES ---
let sfVendorDataStore = { originalData: {}, originalHeaders: [], vendorInfo: {} };
let sfMenuItemsStore = [];
let tfVendorDataStore = { originalData: {}, originalHeaders: [], vendorInfo: {} };
let tfMenuItemsStore = [];

let currentEditingSFToppingsItemId = null;
let nextNewItemIdInternal = { sf: 0, tf: 0 };
let nextNewToppingGroupIdInternal = 0;
let nextNewToppingIdInternal = 0;
const collapsedCategories = { sf: new Set(), tf: new Set() };
const manuallyAddedCategories = { sf: new Set(), tf: new Set() };

// --- EXPORTED GETTERS & SETTERS ---
export const getSfVendorDataStore = () => sfVendorDataStore; // Primarily for direct access if needed by specific modules
export const getSfMenuItemsStore = () => sfMenuItemsStore;     // like api.js or csv.js
export const getTfVendorDataStore = () => tfVendorDataStore;
export const getTfMenuItemsStore = () => tfMenuItemsStore;

export const getCurrentEditingSFToppingsItemId = () => currentEditingSFToppingsItemId;
export const setCurrentEditingSFToppingsItemId = (itemId) => { currentEditingSFToppingsItemId = itemId; };

export const getCollapsedCategoriesSet = (platform) => platform === 'sf' ? collapsedCategories.sf : collapsedCategories.tf;
export const getManuallyAddedCategoriesSet = (platform) => platform === 'sf' ? manuallyAddedCategories.sf : manuallyAddedCategories.tf;

export function getMenuItemsStore(platform) {
    return platform === 'sf' ? sfMenuItemsStore : tfMenuItemsStore;
}
export function setMenuItemsStore(platform, store) {
    if (platform === 'sf') sfMenuItemsStore = store;
    else tfMenuItemsStore = store;
}
export function getVendorDataStore(platform) {
    return platform === 'sf' ? sfVendorDataStore : tfVendorDataStore;
}

export function getNextNewItemId(platform) {
    return nextNewItemIdInternal[platform]++;
}
export function getNextNewToppingGroupId() {
    return nextNewToppingGroupIdInternal++;
}
export function getNextNewToppingId() {
    return nextNewToppingIdInternal++;
}

// Function to reset the actual data stores
export function resetAllStateData() {
    sfVendorDataStore = { originalData: {}, originalHeaders: [], vendorInfo: {} };
    sfMenuItemsStore = [];
    tfVendorDataStore = { originalData: {}, originalHeaders: [], vendorInfo: {} };
    tfMenuItemsStore = [];
    currentEditingSFToppingsItemId = null;
    nextNewItemIdInternal = { sf: 0, tf: 0 };
    nextNewToppingGroupIdInternal = 0;
    nextNewToppingIdInternal = 0;
    collapsedCategories.sf.clear();
    collapsedCategories.tf.clear();
    manuallyAddedCategories.sf.clear();
    manuallyAddedCategories.tf.clear();
}