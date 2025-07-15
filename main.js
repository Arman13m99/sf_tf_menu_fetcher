// static/js/main.js
import * as dom from './dom.js';
import * as state from './state.js'; // May not need direct state import if actions go through other modules
import { handleFetchAndLoad } from './api.js';
import { handleGenerateCsv } from './csv.js';
import { setFetchStatus, resetUI, handleCancelReset } from './ui/common.js';
import { handleAddNewCategory, setupMenuEventListeners, renderMenuItems } from './ui/menu.js';
import {
    handleConfirmShifts,
    initializeShiftsModalTriggers, // For opening modal
    renderWorkScheduleEditor // For direct call when modal opens
} from './ui/shiftsModal.js';
import {
    handleConfirmToppings,
    handleAddToppingGroupToModal,
    handleToppingsModalClicks
} from './ui/toppingsModal.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- INITIAL UI RESET ---
    resetUI(); // From ui/common.js. This also calls setFetchStatus to idle.

    // --- MAIN EVENT LISTENERS ---
    if (dom.fetchButton) {
        dom.fetchButton.addEventListener('click', handleFetchAndLoad);
    }
    if (dom.vendorIdentifierInput) {
        dom.vendorIdentifierInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleFetchAndLoad();
        });
    }

    if (dom.sfAddCategoryButton) {
        dom.sfAddCategoryButton.addEventListener('click', () => handleAddNewCategory('sf'));
    }
    if (dom.tfAddCategoryButton) {
        dom.tfAddCategoryButton.addEventListener('click', () => handleAddNewCategory('tf'));
    }

    if (dom.sfGenerateButton) {
        dom.sfGenerateButton.addEventListener('click', () => {
            handleGenerateCsv('sf');
            setFetchStatus(`Generated SF CSV.`, "success"); // Update status after generation
        });
    }
    if (dom.tfGenerateButton) {
        dom.tfGenerateButton.addEventListener('click', () => {
            handleGenerateCsv('tf');
            setFetchStatus(`Generated TF CSV.`, "success"); // Update status after generation
        });
    }

    if (dom.cancelButton) {
        dom.cancelButton.addEventListener('click', handleCancelReset);
    }

    // --- MODAL SPECIFIC EVENT LISTENERS ---
    // Toppings Modal
    if (dom.confirmToppingsButton) {
        dom.confirmToppingsButton.addEventListener('click', handleConfirmToppings);
    }
    if (dom.addToppingGroupButton) {
        dom.addToppingGroupButton.addEventListener('click', handleAddToppingGroupToModal);
    }
    if (dom.toppingsModalBody) {
        dom.toppingsModalBody.addEventListener('click', handleToppingsModalClicks);
    }

    // Shifts Modal
    if (dom.confirmShiftsButton) {
        dom.confirmShiftsButton.addEventListener('click', handleConfirmShifts);
    }
    // Initialize triggers that open the shifts modal (e.g., buttons with data-bs-target)
    // This was already a function, so we call it.
    // It now correctly uses renderWorkScheduleEditor for setup when a trigger is clicked.
    document.querySelectorAll('[data-bs-target="#shiftsModal"]').forEach(button => {
        button.addEventListener('click', () => {
            // Fetch the latest shiftsData from the state when modal is about to be shown
            const tfShifts = state.getTfVendorDataStore().vendorInfo?.shiftsData || [];
            const sfShifts = state.getSfVendorDataStore().vendorInfo?.shiftsData || [];
            renderWorkScheduleEditor('tf', tfShifts);
            renderWorkScheduleEditor('sf', sfShifts);
            // Bootstrap handles showing the modal via data-bs-toggle and data-bs-target
        });
    });


    // --- MENU EVENT LISTENERS (for item interactions within categories) ---
    // These listeners handle events on dynamically created item cards and category headers.
    setupMenuEventListeners('sf'); // Pass platform, container is resolved inside
    setupMenuEventListeners('tf');

    console.log("Menu Editor Initialized with Modules.");
});