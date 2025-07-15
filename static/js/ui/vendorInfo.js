// static/js/ui/vendorInfo.js
import { isProbablyRTL } from '../utils.js';
import * as state from '../state.js';
import * as dom from '../dom.js'; // Assuming form elements might be in dom.js

export function populateVendorInfoForm(platform, data, originalIdentifierInput) {
    const form = platform === 'sf' ? dom.sfVendorInfoForm : dom.tfVendorInfoForm;
    if (!form) { console.error(`Form not found for ${platform}-vendor-info-form`); return; }

    const originalIdentifierDisp = document.getElementById(`${platform}_original_identifier_display`);
    const originalIdentifierRowDisp = document.getElementById(`${platform}-original-identifier-row`);

    form.reset();

    const codeToDisplay = data.vendor_code || '';
    const name = data.vendor_name || '';
    document.getElementById(`${platform}_vendor_code_id`).value = codeToDisplay;
    document.getElementById(`${platform}_vendor_name`).value = name;
    document.getElementById(`${platform}_vendor_name`).classList.toggle('rtl-input', isProbablyRTL(name));

    if (originalIdentifierInput && codeToDisplay && originalIdentifierInput.toLowerCase() !== codeToDisplay.toLowerCase()) {
        if (originalIdentifierDisp) originalIdentifierDisp.value = originalIdentifierInput;
        if (originalIdentifierRowDisp) originalIdentifierRowDisp.style.display = 'flex';
    } else {
        if (originalIdentifierRowDisp) originalIdentifierRowDisp.style.display = 'none';
    }

    const fields = ['business_line', 'marketing_area', 'address', 'min_order', 'latitude', 'longitude'];
    fields.forEach(f => {
        const el = document.getElementById(`${platform}_${f}`);
        if (el) {
            const val = data[f] || (f === 'min_order' ? '0' : '');
            el.value = val;
            if (f === 'marketing_area' || f === 'address') el.classList.toggle('rtl-input', isProbablyRTL(val));
        }
    });

    if (platform === 'sf') {
        document.getElementById('sf_vendor_branch').value = data.vendor_branch || '';
        document.getElementById('sf_vendor_chain').value = data.vendor_chain || '';
        let tagsVal = '';
        try { const arr = JSON.parse(data.tag_names || "[]"); tagsVal = Array.isArray(arr) ? arr.join(', ') : (data.tag_names || ''); }
        catch (e) { tagsVal = data.tag_names || ''; }
        document.getElementById('sf_tag_names').value = tagsVal;
        document.getElementById('sf_tag_names').classList.toggle('rtl-input', isProbablyRTL(tagsVal));
        document.getElementById('sf_is_express').checked = String(data.is_express).toLowerCase() === 'true';
        document.getElementById('sf_is_pro').checked = String(data.is_pro).toLowerCase() === 'true';
        document.getElementById('sf_is_economical').checked = String(data.is_economical).toLowerCase() === 'true';
    }

    let shiftsData = [];
    try { shiftsData = JSON.parse(data.shifts || '[]'); if (!Array.isArray(shiftsData)) shiftsData = []; }
    catch (e) { console.warn(`Error parsing shifts for ${platform}:`, data.shifts, e); shiftsData = []; }

    const platformVendorStore = state.getVendorDataStore(platform);
    if (!platformVendorStore.vendorInfo) platformVendorStore.vendorInfo = {};
    platformVendorStore.vendorInfo.shiftsData = shiftsData;
    // Ensure snappfood_vendor_id and other specific fields are stored if present in original vendorInfo
    if (platform === 'sf' && data.snappfood_vendor_id) platformVendorStore.vendorInfo.snappfood_vendor_id = data.snappfood_vendor_id;
    if (data.rating) platformVendorStore.vendorInfo.rating = data.rating;
    if (data.comment_count) platformVendorStore.vendorInfo.comment_count = data.comment_count;
    if (platform === 'tf' && data.tf_internal_code) platformVendorStore.vendorInfo.tf_internal_code = data.tf_internal_code;
}

export function getVendorInfoFromForm(platform) {
    const data = {};
    const prefix = platform + '_';
    const getVal = (id, def = '') => document.getElementById(id)?.value || def;
    const getChecked = (id, def = false) => document.getElementById(id)?.checked || def;
    data.vendor_code = getVal(prefix + 'vendor_code_id');
    data.vendor_name = getVal(prefix + 'vendor_name');
    data.business_line = getVal(prefix + 'business_line');
    data.marketing_area = getVal(prefix + 'marketing_area');
    data.address = getVal(prefix + 'address');
    data.min_order = getVal(prefix + 'min_order', '0');
    data.latitude = getVal(prefix + 'latitude');
    data.longitude = getVal(prefix + 'longitude');

    const storedVendorInfo = state.getVendorDataStore(platform).vendorInfo || {};
    data.shifts = storedVendorInfo.shiftsData || []; // Get shifts from memory, not the form directly

    if (platform === 'sf') {
        data.vendor_branch = getVal(prefix + 'vendor_branch');
        data.vendor_chain = getVal(prefix + 'vendor_chain');
        data.tag_names = getVal(prefix + 'tag_names'); // This is user input, will be JSONified by CSV generator
        data.is_express = getChecked(prefix + 'is_express');
        data.is_pro = getChecked(prefix + 'is_pro');
        data.is_economical = getChecked(prefix + 'is_economical');
        // These come from original data, not editable in form, but needed for CSV
        data.snappfood_vendor_id = storedVendorInfo.snappfood_vendor_id || '';
        data.rating = storedVendorInfo.rating || '0';
        data.comment_count = storedVendorInfo.comment_count || '0';

    } else { // TF
        data.tf_internal_code = storedVendorInfo.tf_internal_code || ''; // Example if Tapsi had such a field
        data.rating = storedVendorInfo.rating || '0'; // If Tapsi also has rating
        data.comment_count = storedVendorInfo.comment_count || '0'; // If Tapsi also has comment_count
    }
    return data;
}