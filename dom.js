// static/js/dom.js
export const vendorIdentifierInput = document.getElementById('vendor-identifier-input');
export const fetchButton = document.getElementById('fetch-button');
export const fetchSpinner = fetchButton.querySelector('.spinner-border');
export const fetchStatus = document.getElementById('fetch-status');
export const sfMenuItemsContainer = document.getElementById('sf-menu-items-container');
export const sfAddCategoryButton = document.getElementById('sf-add-category-button');
export const sfGenerateButton = document.getElementById('sf-generate-button');
export const sfCategoryQuickNav = document.getElementById('sf-category-quick-nav');
export const tfMenuItemsContainer = document.getElementById('tf-menu-items-container');
export const tfAddCategoryButton = document.getElementById('tf-add-category-button');
export const tfGenerateButton = document.getElementById('tf-generate-button');
export const tfCategoryQuickNav = document.getElementById('tf-category-quick-nav');
export const toppingsModalElement = document.getElementById('toppingsModal');
export const toppingsModalInstance = new bootstrap.Modal(toppingsModalElement); // Renamed for clarity
export const toppingsModalBody = document.getElementById('toppingsModalBody');
export const toppingsModalLabel = document.getElementById('toppingsModalLabel');
export const confirmToppingsButton = document.getElementById('confirmToppingsButton');
export const addToppingGroupButton = document.getElementById('add-topping-group-button');
export const shiftsModalElement = document.getElementById('shiftsModal');
export const shiftsModalInstance = new bootstrap.Modal(shiftsModalElement); // Renamed for clarity
export const tfWorkScheduleBody = document.getElementById('tf-work-schedule-body');
export const sfWorkScheduleBody = document.getElementById('sf-work-schedule-body');
export const confirmShiftsButton = document.getElementById('confirmShiftsButton');
export const cancelButton = document.getElementById('cancel-button');

// Add any other direct element selections here.
// Forms for vendor info
export const sfVendorInfoForm = document.getElementById('sf-vendor-info-form');
export const tfVendorInfoForm = document.getElementById('tf-vendor-info-form');