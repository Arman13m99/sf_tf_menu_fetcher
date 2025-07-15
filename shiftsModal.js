// static/js/ui/shiftsModal.js
import * as dom from '../dom.js';
import * as state from '../state.js';
import { API_WEEKDAY_TO_UI_DAY, UI_DAY_ORDER } from '../constants.js'; // Import constants
import { setFetchStatus } from './common.js';

function createShiftRowHTML(startTime = "09:00", endTime = "17:00", enabled = true) {
    const format = (t, defaultTime = "00:00") => {
        if (!t || typeof t !== 'string' || !t.includes(':')) return defaultTime;
        const [hr, min] = t.split(':');
        return `${String(hr).padStart(2, '0')}:${String(min || '00').padStart(2, '0')}`;
    };
    return `
        <div class="shift-row d-flex align-items-center mb-2">
            <input type="time" class="form-control form-control-sm schedule-time-input me-1" value="${format(startTime)}" ${!enabled ? 'disabled' : ''}>
            <span class="mx-1 time-separator">-</span>
            <input type="time" class="form-control form-control-sm schedule-time-input me-2" value="${format(endTime, "23:59")}" ${!enabled ? 'disabled' : ''}>
            <button class="btn btn-sm btn-outline-danger remove-shift-btn" type="button" ${!enabled ? 'disabled' : ''} title="Remove Shift">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-x-lg" viewBox="0 0 16 16"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/></svg>
            </button>
        </div>`;
}

export function renderWorkScheduleEditor(platform, shiftsDataArray) {
    const container = platform === 'tf' ? dom.tfWorkScheduleBody : dom.sfWorkScheduleBody;
    container.innerHTML = '';
    if (!Array.isArray(shiftsDataArray)) shiftsDataArray = [];

    const shiftsByApiWeekday = shiftsDataArray.reduce((acc, s) => {
        const key = s.weekday;
        if (!acc[key]) acc[key] = [];
        const formatTime = (timeStr, defaultTime = "00:00") => {
            if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return defaultTime;
            const [hr, min] = timeStr.split(':');
            return `${String(hr).padStart(2, '0')}:${String(min || '00').padStart(2, '0')}`;
        };
        acc[key].push({ startHour: formatTime(s.startHour), stopHour: formatTime(s.stopHour, "23:59") });
        return acc;
    }, {});

    UI_DAY_ORDER.forEach(dayName => {
        const apiWeekday = Object.keys(API_WEEKDAY_TO_UI_DAY).find(k => API_WEEKDAY_TO_UI_DAY[k] === dayName);
        const dayShiftsForThisDay = apiWeekday && shiftsByApiWeekday[apiWeekday] ? shiftsByApiWeekday[apiWeekday] : [];
        const dayContainer = document.createElement('div');
        dayContainer.className = 'day-schedule-container mb-3 p-2 border rounded-1';
        dayContainer.dataset.dayName = dayName;
        if (apiWeekday) dayContainer.dataset.apiWeekday = apiWeekday;

        const headerDiv = document.createElement('div');
        headerDiv.className = 'd-flex align-items-center mb-2';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'form-check-input me-2 schedule-day-master-active';
        checkbox.id = `schedule-active-${platform}-${dayName.toLowerCase()}`;
        checkbox.checked = dayShiftsForThisDay.length > 0;

        const label = document.createElement('label');
        label.className = 'day-label form-label fw-bold mb-0 me-auto';
        label.htmlFor = checkbox.id;
        label.textContent = dayName;

        const addShiftBtn = document.createElement('button');
        addShiftBtn.type = 'button';
        addShiftBtn.className = 'btn btn-sm btn-outline-success add-shift-btn';
        addShiftBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-plus-lg" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/></svg>`;
        addShiftBtn.title = "Add Shift";
        addShiftBtn.disabled = !checkbox.checked;

        headerDiv.append(checkbox, label, addShiftBtn);
        dayContainer.appendChild(headerDiv);

        const shiftsContainerDiv = document.createElement('div');
        shiftsContainerDiv.className = 'shifts-for-day-container ms-3';
        dayContainer.appendChild(shiftsContainerDiv);

        if (checkbox.checked) {
            if (dayShiftsForThisDay.length > 0) {
                dayShiftsForThisDay.forEach(s => shiftsContainerDiv.insertAdjacentHTML('beforeend', createShiftRowHTML(s.startHour, s.stopHour, true)));
            } else { // Default shift if day is active but no shifts defined
                shiftsContainerDiv.insertAdjacentHTML('beforeend', createShiftRowHTML("09:00", "17:00", true));
            }
        }

        checkbox.addEventListener('change', e => {
            const isEnabled = e.target.checked;
            addShiftBtn.disabled = !isEnabled;
            shiftsContainerDiv.querySelectorAll('.shift-row input, .shift-row button').forEach(el => el.disabled = !isEnabled);
            if (isEnabled && shiftsContainerDiv.children.length === 0) {
                shiftsContainerDiv.insertAdjacentHTML('beforeend', createShiftRowHTML("09:00", "17:00", true));
            }
        });

        addShiftBtn.addEventListener('click', () => {
            if (checkbox.checked) {
                shiftsContainerDiv.insertAdjacentHTML('beforeend', createShiftRowHTML("09:00", "17:00", true));
            }
        });
        container.appendChild(dayContainer);
    });

    if (!container.dataset.removeListenerAdded) { // Ensure listener is added only once per container
        container.addEventListener('click', e => {
            if (e.target.classList.contains('remove-shift-btn') || e.target.closest('.remove-shift-btn')) {
                e.target.closest('.shift-row')?.remove();
            }
        });
        container.dataset.removeListenerAdded = "true";
    }
     if (UI_DAY_ORDER.length === 0 || container.children.length === 0 && shiftsDataArray.length === 0) { // Condition updated
        container.innerHTML = `<p class="text-muted text-center small">No schedule data loaded or configured for ${platform.toUpperCase()}.</p>`;
    }
}

function getShiftsFromUIEditor(platform) {
    const shifts = [];
    const container = platform === 'tf' ? dom.tfWorkScheduleBody : dom.sfWorkScheduleBody;
    container.querySelectorAll('.day-schedule-container').forEach(dayDiv => {
        const activeCheckbox = dayDiv.querySelector('.schedule-day-master-active');
        const apiWeekdayStr = dayDiv.dataset.apiWeekday;
        if (activeCheckbox && activeCheckbox.checked && apiWeekdayStr) {
            const apiWeekday = parseInt(apiWeekdayStr);
            dayDiv.querySelectorAll('.shifts-for-day-container .shift-row').forEach(row => {
                const timeInputs = row.querySelectorAll('.schedule-time-input');
                if (timeInputs.length === 2 && timeInputs[0].value && timeInputs[1].value) {
                    shifts.push({ weekday: apiWeekday, allDay: false, startHour: timeInputs[0].value, stopHour: timeInputs[1].value });
                }
            });
        }
    });
    return shifts;
}

export function handleConfirmShifts() {
    const tfShifts = getShiftsFromUIEditor('tf');
    const sfShifts = getShiftsFromUIEditor('sf');

    // Update state directly (or through setter if more logic involved)
    const tfDataStore = state.getTfVendorDataStore();
    if (!tfDataStore.vendorInfo) tfDataStore.vendorInfo = {};
    tfDataStore.vendorInfo.shiftsData = tfShifts;

    const sfDataStore = state.getSfVendorDataStore();
    if (!sfDataStore.vendorInfo) sfDataStore.vendorInfo = {};
    sfDataStore.vendorInfo.shiftsData = sfShifts;

    dom.shiftsModalInstance.hide();
    setFetchStatus("Shifts updated in memory.", "success");
}

export function initializeShiftsModalTriggers() {
    document.querySelectorAll('[data-bs-target="#shiftsModal"]').forEach(button => {
        button.addEventListener('click', () => {
            renderWorkScheduleEditor('tf', state.getTfVendorDataStore().vendorInfo?.shiftsData || []);
            renderWorkScheduleEditor('sf', state.getSfVendorDataStore().vendorInfo?.shiftsData || []);
            // Note: Modal show is handled by Bootstrap attributes, or you can do dom.shiftsModalInstance.show();
        });
    });
}