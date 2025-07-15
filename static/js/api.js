// static/js/api.js
import * as dom from './dom.js';
import * as state from './state.js';
import { setFetchStatus, resetUI } from './ui/common.js';
import { populateVendorInfoForm } from './ui/vendorInfo.js';
import { renderMenuItems } from './ui/menu.js';
// PapaParse is global

function getPlatformSpecificGenerateButton(platform) {
    return platform === 'sf' ? dom.sfGenerateButton : dom.tfGenerateButton;
}

function getPlatformSpecificMenuItemsContainer(platform) {
    return platform === 'sf' ? dom.sfMenuItemsContainer : dom.tfMenuItemsContainer;
}


export function processPlatformData(platform, csvData, vendorInfo, originalIdentifier) {
    setFetchStatus(`Processing ${platform.toUpperCase()} data...`, "processing");

    const papaDone = (parseResults) => {
        const menuItemsContainer = getPlatformSpecificMenuItemsContainer(platform);
        const generateButton = getPlatformSpecificGenerateButton(platform);

        if (parseResults.errors.length > 0) {
            console.error(`PapaParse Errors for ${platform}:`, parseResults.errors);
            setFetchStatus(`Error parsing ${platform.toUpperCase()} CSV.`, "error");
            if(menuItemsContainer) menuItemsContainer.innerHTML = `<div class="text-center p-5 initial-message text-danger"><h5>Error parsing ${platform.toUpperCase()} menu data.</h5></div>`;
            // renderMenuItems(platform) would also clear and populate quick nav if it had categories
            renderMenuItems(platform); // To ensure quick nav is also cleared/updated
            populateVendorInfoForm(platform, vendorInfo || {}, originalIdentifier);
            if (generateButton) generateButton.disabled = true;
            return;
        }

        const currentVendorDataStore = state.getVendorDataStore(platform);
        currentVendorDataStore.vendorInfo = vendorInfo || (parseResults.data && parseResults.data[0] ? { ...parseResults.data[0] } : {});
        currentVendorDataStore.originalHeaders = parseResults.meta.fields || [];

        if (parseResults.data && parseResults.data[0]) {
            // Store a copy of the first row as potential base for vendor info if not explicitly provided
            currentVendorDataStore.originalData = { ...parseResults.data[0] };
        } else {
            currentVendorDataStore.originalData = {};
        }
        // Store original snappfood_vendor_id or other crucial IDs from vendorInfo into the store
        if(vendorInfo) {
             if (platform === 'sf' && vendorInfo.snappfood_vendor_id) currentVendorDataStore.vendorInfo.snappfood_vendor_id = vendorInfo.snappfood_vendor_id;
             if (vendorInfo.rating) currentVendorDataStore.vendorInfo.rating = vendorInfo.rating;
             if (vendorInfo.comment_count) currentVendorDataStore.vendorInfo.comment_count = vendorInfo.comment_count;
             // Add other platform specific ids if necessary
        }


        populateVendorInfoForm(platform, currentVendorDataStore.vendorInfo, originalIdentifier);
        state.getManuallyAddedCategoriesSet(platform).clear(); // Clear manually added for this platform

        if (!parseResults.data || parseResults.data.length === 0) {
            setFetchStatus(`${platform.toUpperCase()} menu is empty. Vendor info processed.`, "success");
            state.setMenuItemsStore(platform, []);
            renderMenuItems(platform); // Will show empty message and update quick nav
            if (generateButton) generateButton.disabled = true;
            return;
        }

        const menuItems = parseResults.data.map((row, idx) => {
            let toppings = [];
            if (platform === 'sf' && row.product_toppings) {
                try {
                    const parsedToppings = JSON.parse(row.product_toppings || '[]');
                    if (Array.isArray(parsedToppings)) {
                        toppings = parsedToppings.map((g, gi) => ({
                            ...g,
                            domId: `group-src-${platform}-${idx}-${gi}`,
                            originalGroupId: g.id, // Store original ID
                            selected: true, // Default to selected
                            toppings: (Array.isArray(g.toppings) ? g.toppings : []).map((t, ti) => ({
                                ...t,
                                domId: `topping-src-${platform}-${idx}-${gi}-${ti}`,
                                originalToppingId: t.id, // Store original ID
                                selected: true // Default to selected
                            }))
                        }));
                    }
                } catch (e) { console.warn(`Error parsing toppings for ${platform} item ${idx}:`, e, row.product_toppings); }
            }
            return {
                domId: `item-src-${platform}-${idx}`,
                selected: true, // Default all loaded items to selected
                itemId: row.item_id || '',
                itemTitle: row.item_title || '',
                description: row.description || row.item_description || '',
                price: parseFloat(row.price) || 0,
                rating: parseFloat(row.rating) || 0,
                categoryName: row.category_name || "Uncategorized",
                productToppings: toppings, // SF specific
                originalRowData: { ...row }, // Store the full original row
                platform: platform
            };
        });
        state.setMenuItemsStore(platform, menuItems);
        renderMenuItems(platform);
        if (generateButton) generateButton.disabled = menuItems.length === 0;
        setFetchStatus(`${platform.toUpperCase()} menu processed successfully.`, "success");
    };

    Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: papaDone,
        error: (err) => {
            console.error(`PapaParse Critical Error for ${platform}:`, err);
            setFetchStatus(`Fatal error processing ${platform.toUpperCase()} CSV.`, "error");
            if(getPlatformSpecificMenuItemsContainer(platform)) getPlatformSpecificMenuItemsContainer(platform).innerHTML = `<div class="text-center p-5 initial-message text-danger"><h5>Fatal error processing ${platform.toUpperCase()} menu data. Check console.</h5></div>`;
            renderMenuItems(platform); // Clear quick nav etc.
            populateVendorInfoForm(platform, vendorInfo || {}, originalIdentifier);
            if (getPlatformSpecificGenerateButton(platform)) getPlatformSpecificGenerateButton(platform).disabled = true;
        }
    });
}


export async function handleFetchAndLoad() {
    const identifier = dom.vendorIdentifierInput.value.trim();
    if (!identifier) {
        setFetchStatus("Please enter a Vendor Code or URL.", "error");
        dom.vendorIdentifierInput.focus();
        return;
    }

    // Before fetching new data, reset relevant parts of the state and UI for both platforms
    // This ensures a clean slate if one platform loads and the other fails, or for subsequent fetches.
    state.resetAllStateData(); // Resets sfVendorDataStore, tfVendorDataStore, menu item stores etc.
    resetUI(); // Full UI reset to initial messages etc.
    // Note: resetUI calls setFetchStatus("Status: Idle", "idle") at the end.
    // So we immediately call it again for loading.
    setFetchStatus("Fetching data...", "loading");

    try {
        const response = await fetch('/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: identifier })
        });
        const result = await response.json();
        console.log("Backend Response:", result);

        if (response.ok && result.success) {
            let messages = [];
            let sfLoadedSuccessfully = false;
            let tfLoadedSuccessfully = false;
            const sfGenerateBtn = getPlatformSpecificGenerateButton('sf');
            const tfGenerateBtn = getPlatformSpecificGenerateButton('tf');
            const sfContainer = getPlatformSpecificMenuItemsContainer('sf');
            const tfContainer = getPlatformSpecificMenuItemsContainer('tf');


            // --- SnappFood Processing ---
            if (result.snappfood) {
                if (result.snappfood.data_loaded) {
                    messages.push(`SnappFood data for ${result.snappfood.original_identifier || 'vendor'} loaded.`);
                    if (result.snappfood.csv_data) {
                         processPlatformData('sf', result.snappfood.csv_data, result.snappfood.vendor_info, result.snappfood.original_identifier);
                         sfLoadedSuccessfully = true;
                    } else { // Data loaded but no CSV (e.g., only vendor info, empty menu)
                        populateVendorInfoForm('sf', result.snappfood.vendor_info || {}, result.snappfood.original_identifier);
                        if (sfContainer) sfContainer.innerHTML = `<div class="text-center p-5 initial-message"><h5>SnappFood menu data not available or empty. Vendor info loaded.</h5></div>`;
                        renderMenuItems('sf'); // To update quicknav based on no items
                        sfLoadedSuccessfully = true; // Vendor info is still a success
                    }
                } else { // data_loaded is false
                    messages.push(`SF: ${result.snappfood.error || 'Failed to load SnappFood data.'}`);
                    populateVendorInfoForm('sf', result.snappfood.vendor_info || {}, result.snappfood.original_identifier); // Still populate if info came
                    if(sfContainer) sfContainer.innerHTML = `<div class="text-center p-5 initial-message"><h5>SnappFood data could not be loaded. ${result.snappfood.error || ''}</h5></div>`;
                    renderMenuItems('sf');
                }
                if (sfGenerateBtn) sfGenerateBtn.disabled = !sfLoadedSuccessfully || state.getMenuItemsStore('sf').length === 0 && state.getManuallyAddedCategoriesSet('sf').size === 0;
            }


            // --- TapsiFood Processing ---
            if (result.tapsifood) {
                if (result.tapsifood.data_loaded) {
                    messages.push(`TapsiFood data for ${result.tapsifood.original_identifier || 'vendor'} loaded.`);
                     if (result.tapsifood.csv_data) {
                        processPlatformData('tf', result.tapsifood.csv_data, result.tapsifood.vendor_info, result.tapsifood.original_identifier);
                        tfLoadedSuccessfully = true;
                     } else {
                        populateVendorInfoForm('tf', result.tapsifood.vendor_info || {}, result.tapsifood.original_identifier);
                        if(tfContainer) tfContainer.innerHTML = `<div class="text-center p-5 initial-message"><h5>TapsiFood menu data not available or empty. Vendor info loaded.</h5></div>`;
                        renderMenuItems('tf');
                        tfLoadedSuccessfully = true;
                     }
                } else {
                    messages.push(`TF: ${result.tapsifood.error || 'Failed to load TapsiFood data.'}`);
                    populateVendorInfoForm('tf', result.tapsifood.vendorInfo || {}, result.tapsifood.original_identifier);
                    if(tfContainer) tfContainer.innerHTML = `<div class="text-center p-5 initial-message"><h5>TapsiFood data could not be loaded. ${result.tapsifood.error || ''}</h5></div>`;
                    renderMenuItems('tf');
                }
                if(tfGenerateBtn) tfGenerateBtn.disabled = !tfLoadedSuccessfully || state.getMenuItemsStore('tf').length === 0 && state.getManuallyAddedCategoriesSet('tf').size === 0;
            }

            setFetchStatus(messages.join(' '), "success");

        } else { // response not ok or result.success is false
            console.error("Backend Error or overall failure:", result);
            setFetchStatus(`Error: ${result.error || 'Failed to fetch data from backend.'}`, "error");
            // resetUI() was already called at the beginning of handleFetchAndLoad.
            // If fetch fails completely, UI is already in reset state.
        }
    } catch (error) {
        console.error('Fetch Network/Server Error:', error);
        setFetchStatus("Network Error or Server Down. Check console.", "error");
        alert(`Could not connect to backend or critical error occurred.\nError: ${error.message}`);
        // resetUI() already called.
    }
}