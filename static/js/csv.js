// static/js/csv.js
import * as state from './state.js';
import { getVendorInfoFromForm } from './ui/vendorInfo.js';
import { convertTagsInputToJSON, downloadCSV } from './utils.js';
// PapaParse is assumed to be globally available (from papaparse.min.js script tag)
// If you prefer to import it as a module, you'd need a modular version of PapaParse.

export function handleGenerateCsv(platform) {
    const menuItems = state.getMenuItemsStore(platform).filter(item => item.selected);
    const vendorInfoFromForm = getVendorInfoFromForm(platform); // from ui/vendorInfo.js
    let originalHeaders = state.getVendorDataStore(platform).originalHeaders || [];

    if (menuItems.length === 0 && Object.keys(vendorInfoFromForm).every(k => !vendorInfoFromForm[k] && k !== 'shifts' && k !== 'tag_names')) {
        alert(`No data to generate for ${platform.toUpperCase()}. Load or add some data first.`);
        return;
    }

    // If no items and original headers are empty, try to create default headers
    // This is for the case where only vendor info is entered without loading a file first.
    if (menuItems.length === 0 && originalHeaders.length === 0) {
        if (platform === 'tf' && Object.values(vendorInfoFromForm).some(v => v || v === 0 || v === false)) {
             originalHeaders = ["vendor_code", "vendor_name", "business_line", "marketing_area", "address", "min_order", "latitude", "longitude", "shifts", "category_name", "item_id", "item_title", "item_description", "description", "price", "rating", "product_toppings"];
        } else if (platform === 'sf' && Object.values(vendorInfoFromForm).some(v => v || v === 0 || v === false)){
             originalHeaders = ["vendor_code", "snappfood_vendor_id", "vendor_name", "vendor_branch", "vendor_chain", "business_line", "marketing_area", "address", "min_order", "latitude", "longitude", "rating", "comment_count", "shifts", "tag_names", "is_express", "is_pro", "is_economical", "category_name", "item_id", "item_title", "description", "price", "product_toppings"];
        } else {
            alert(`No items selected or available, and no headers found for ${platform.toUpperCase()}. Cannot determine CSV structure.`);
            return;
        }
    }


    const dataToExport = menuItems.map(item => {
        let baseRow = {};
        // Initialize baseRow with original headers to maintain column order and include all original fields
        if (originalHeaders.length > 0) {
            baseRow = Object.fromEntries(originalHeaders.map(h => [h, ''])); // Default to empty strings
        }

        // If the item is not new and has originalRowData, use that as a base
        if (item.originalRowData && Object.keys(item.originalRowData).length > 0 && !item.domId.startsWith(`item-new-${platform}-`)) {
            baseRow = { ...baseRow, ...item.originalRowData }; // Spread original first, then specific overrides
        }

        // Overlay with current vendor info from the form
        for (const key in vendorInfoFromForm) {
            if (Object.hasOwnProperty.call(vendorInfoFromForm, key)) {
                if (key === 'is_express' || key === 'is_pro' || key === 'is_economical') {
                     baseRow[key] = vendorInfoFromForm[key] ? 'True' : 'False'; // CSVs often use True/False strings
                } else if (key === 'tag_names' && platform === 'sf') {
                     baseRow[key] = convertTagsInputToJSON(vendorInfoFromForm[key] || "");
                } else if (key === 'shifts') {
                     baseRow[key] = JSON.stringify(vendorInfoFromForm[key] || []);
                }
                else {
                    baseRow[key] = vendorInfoFromForm[key];
                }
            }
        }

        // Set item-specific fields from the UI data store
        baseRow.category_name = item.categoryName;
        baseRow.item_id = item.itemId || ''; // Use item's specific ID or empty if new
        baseRow.item_title = item.itemTitle;
        baseRow.description = item.description; // Common description field
        baseRow.price = item.price;
        baseRow.rating = item.rating;

        if (platform === 'sf') {
            baseRow.product_toppings = JSON.stringify(
                (item.productToppings || []).filter(g => g.selected).map(g => ({
                    id: (typeof g.originalGroupId !== 'undefined' && g.originalGroupId !== null && String(g.originalGroupId).trim() !== "") ? g.originalGroupId : (g.id || ''),
                    title: g.title, maxCount: g.maxCount, minCount: g.minCount,
                    toppings: (g.toppings || []).filter(t => t.selected).map(t_data => ({
                        id: (typeof t_data.originalToppingId !== 'undefined' && t_data.originalToppingId !== null && String(t_data.originalToppingId).trim() !== "") ? t_data.originalToppingId : (t_data.id || ''),
                        title: t_data.title, description: t_data.description, price: t_data.price
                    }))
                })), null, 0); // Minified JSON
        } else { // TF
            baseRow.product_toppings = "[]"; // TapsiFood generally doesn't have toppings in this complex structure
            // Ensure Tapsi's specific description field is populated if it exists
            if (originalHeaders.includes('item_description') && !baseRow.hasOwnProperty('item_description')) {
                baseRow.item_description = item.description;
            }
        }
        // Ensure all original headers are present in the final row object
        originalHeaders.forEach(h => { if (!baseRow.hasOwnProperty(h)) baseRow[h] = ""; });

        return baseRow;
    });

    // If there are no items, but vendor info was entered, create a single row for vendor info.
    if (dataToExport.length === 0 && menuItems.length === 0) {
        let singleVendorRow = {};
        if(originalHeaders.length > 0) {
            singleVendorRow = Object.fromEntries(originalHeaders.map(h => [h, '']));
        }

        for (const key in vendorInfoFromForm) {
             if (key === 'is_express' || key === 'is_pro' || key === 'is_economical') {
                 singleVendorRow[key] = vendorInfoFromForm[key] ? 'True' : 'False';
            } else if (key === 'tag_names' && platform === 'sf') {
                 singleVendorRow[key] = convertTagsInputToJSON(vendorInfoFromForm[key] || "");
            } else if (key === 'shifts') {
                 singleVendorRow[key] = JSON.stringify(vendorInfoFromForm[key] || []);
            } else {
                singleVendorRow[key] = vendorInfoFromForm[key];
            }
        }
        originalHeaders.forEach(h => { if (!singleVendorRow.hasOwnProperty(h)) singleVendorRow[h] = ""; });
        dataToExport.push(singleVendorRow);
    }


    let headersForCsv = originalHeaders;
    // Fallback default headers if originalHeaders is still empty (e.g. new file from scratch)
    // This ensures Papa.unparse has headers.
    if (!headersForCsv || headersForCsv.length === 0) {
         if (platform === 'tf') {
            // A more comprehensive default set for TF if starting from scratch
            headersForCsv = ["vendor_code", "vendor_name", "business_line", "marketing_area", "address", "min_order", "latitude", "longitude", "shifts", "category_name", "item_id", "item_title", "item_description", "description", "price", "rating", "product_toppings"];
         } else { // SF
            // A more comprehensive default set for SF
            headersForCsv = ["vendor_code", "snappfood_vendor_id", "vendor_name", "vendor_branch", "vendor_chain", "business_line", "marketing_area", "address", "min_order", "latitude", "longitude", "rating", "comment_count", "shifts", "tag_names", "is_express", "is_pro", "is_economical", "category_name", "item_id", "item_title", "description", "price", "product_toppings"];
         }
         console.warn(`Original headers for ${platform} were missing or empty. Using a default set of headers for CSV generation.`);
    }


    try {
        const csv = Papa.unparse(dataToExport, {
            header: true,
            columns: headersForCsv, // Use determined headers
            quotes: true, // Ensure fields with commas or newlines are quoted
            newline: "\r\n" // Standard CSV newline
        });
        const filename = `edited_${platform}_menu_${(vendorInfoFromForm.vendor_code || 'export').replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
        downloadCSV(csv, filename); // from utils.js
        // Set status via ui/common.js, will need to import it in main.js and pass it around or call directly
        // For now, we assume setFetchStatus can be called globally if needed, or better, call it from main.js
        console.log(`Generated ${filename}`); // Temporary, actual status update from main call site
    } catch (error) {
        console.error("Error generating CSV:", error);
        alert(`Error generating CSV for ${platform.toUpperCase()}: ${error.message}`);
    }
}