// static/js/ui/common.js
import * as dom from '../dom.js'; // Import all exported members from dom.js as 'dom' object
import { resetAllStateData } from '../state.js';

export function setFetchStatus(message, state = "idle") {
    if (!dom.fetchStatus || !dom.fetchSpinner || !dom.fetchButton) return;
    dom.fetchStatus.textContent = message;
    dom.fetchSpinner.style.display = state === 'loading' ? 'inline-block' : 'none';
    dom.fetchButton.disabled = state === 'loading';
    let className = 'text-light small ms-3';
    if (state === 'error') className = 'text-danger small ms-3 fw-bold';
    else if (state === 'success') className = 'text-white small ms-3 fw-bold bg-success p-1 rounded';
    else if (state === 'processing') className = 'text-warning small ms-3 fw-bold';
    dom.fetchStatus.className = className;
    if ((state === 'success' || state === 'error' || state === 'processing') && message !== "Fetching data...") {
        setTimeout(() => {
            // Consider if you want to clear the message or change state back to idle
            // if (dom.fetchStatus.textContent === message) { /* dom.fetchStatus.textContent = ''; */ }
        }, 7000);
    } else if (state === "idle") {
        dom.fetchStatus.className = 'text-light small ms-3';
    }
}

export function resetUI() {
    dom.sfVendorInfoForm?.reset();
    dom.tfVendorInfoForm?.reset();

    ['sf_vendor_code_id', 'sf_vendor_name', 'sf_vendor_branch', 'sf_vendor_chain', 'sf_business_line', 'sf_marketing_area', 'sf_address', 'sf_tag_names',
     'tf_vendor_code_id', 'tf_vendor_name', 'tf_business_line', 'tf_marketing_area', 'tf_address'].forEach(id => {
        const el = document.getElementById(id); // Keep getElementById for dynamically created elements if any, or ensure they are in dom.js
        if (el) { el.value = ''; el.classList.remove('rtl-input'); }
    });

    const sfOrigIdRow = document.getElementById('sf-original-identifier-row');
    if (sfOrigIdRow) sfOrigIdRow.style.display = 'none';
    const tfOrigIdRow = document.getElementById('tf-original-identifier-row');
    if (tfOrigIdRow) tfOrigIdRow.style.display = 'none';

    const initialMsg = (platform) => `<div class="text-center p-5 initial-message"><h5>Load data to see ${platform.toUpperCase()} menu</h5></div>`;
    if (dom.sfMenuItemsContainer) dom.sfMenuItemsContainer.innerHTML = initialMsg("SnappFood");
    if (dom.tfMenuItemsContainer) dom.tfMenuItemsContainer.innerHTML = initialMsg("TapsiFood");
    if (dom.sfCategoryQuickNav) dom.sfCategoryQuickNav.innerHTML = '<span class="text-muted small p-1">No categories loaded.</span>';
    if (dom.tfCategoryQuickNav) dom.tfCategoryQuickNav.innerHTML = '<span class="text-muted small p-1">No categories loaded.</span>';
    if (dom.tfWorkScheduleBody) dom.tfWorkScheduleBody.innerHTML = '<p class="text-muted text-center small">Load TapsiFood data for schedule.</p>';
    if (dom.sfWorkScheduleBody) dom.sfWorkScheduleBody.innerHTML = '<p class="text-muted text-center small">Load SnappFood data for schedule.</p>';

    if (dom.vendorIdentifierInput) dom.vendorIdentifierInput.value = '';
    if (dom.sfGenerateButton) dom.sfGenerateButton.disabled = true;
    if (dom.tfGenerateButton) dom.tfGenerateButton.disabled = true;

    // Reset dataset attributes related to listeners for shifts modal
    if(dom.tfWorkScheduleBody && dom.tfWorkScheduleBody.dataset.removeListenerAdded) delete dom.tfWorkScheduleBody.dataset.removeListenerAdded;
    if(dom.sfWorkScheduleBody && dom.sfWorkScheduleBody.dataset.removeListenerAdded) delete dom.sfWorkScheduleBody.dataset.removeListenerAdded;

    setFetchStatus("Status: Idle", "idle");
}

export function handleCancelReset() {
    if (confirm("Reset all data and clear both platforms?")) {
        resetAllStateData(); // Resets the actual data
        resetUI();           // Resets the visual interface
        setFetchStatus("Editor reset.", "idle");
    }
}