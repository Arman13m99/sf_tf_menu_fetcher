// static/js/utils.js

export function isProbablyRTL(text) {
    return !text ? false : /[\u0600-\u06FF\u0750-\u077F\u0590-\u05FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

export function convertTagsInputToJSON(tagsString) {
    if (!tagsString || tagsString.trim() === '') return JSON.stringify([]);
    const tagsArray = tagsString.split(',').map(t => t.trim()).filter(t => t);
    return JSON.stringify(tagsArray);
}

export function downloadCSV(csvContent, fileName) {
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } else {
        alert("CSV download is not supported in your browser.");
    }
}