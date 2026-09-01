// ==UserScript==
// @name         Earth Empires – News Search History
// @namespace    https://github.com/skylozerus/earth_empire_advanced
// @version      1.2
// @description  Saves searched country numbers and the last hours-back value; restores hrs on load; preset 6h/12h/24h/48h buttons.
// @author       skylozerus
// @match        https://*.earthempires.com/*/news*
// @match        https://earthempires.com/*/news*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
        #ee-news-history-container {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #0a0a2a 0%, #001a3a 60%, #002b1a 100%);
            border: 1px solid #2a6a4a;
            border-radius: 6px;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
            color: #c0d8c0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        }
        #ee-news-history-container .label {
            font-weight: bold;
            color: #6fd98a;
            margin-right: 4px;
            user-select: none;
        }
        .ee-history-btn {
            background: #0d1f14;
            color: #a0f0b0;
            border: 1px solid #2a6a4a;
            border-radius: 4px;
            padding: 2px 7px;
            cursor: pointer;
            font-size: 11px;
            transition: transform 0.1s, background-color 0.1s, border-color 0.1s;
        }
        .ee-history-btn:hover {
            background: #183e26;
            border-color: #4caf70;
            color: #ffffff;
            transform: translateY(-1px);
        }
        .ee-history-btn:active {
            transform: translateY(0);
        }
        .ee-history-clear-btn {
            background: transparent;
            color: #88c8a0;
            border: none;
            cursor: pointer;
            font-size: 10px;
            margin-left: auto;
            padding: 2px 5px;
            text-decoration: underline;
            transition: color 0.15s;
        }
        .ee-history-clear-btn:hover {
            color: #ff6b6b;
            text-decoration: none;
        }
        .ee-hrs-btn {
            background: #0d1a2a;
            color: #80c8f0;
            border: 1px solid #2a5a8a;
            border-radius: 4px;
            padding: 1px 6px;
            cursor: pointer;
            font-size: 11px;
            transition: transform 0.1s, background-color 0.1s, border-color 0.1s;
        }
        .ee-hrs-btn:hover {
            background: #183050;
            border-color: #4c8fcf;
            color: #ffffff;
            transform: translateY(-1px);
        }
        .ee-hrs-btn:active {
            transform: translateY(0);
        }
        .ee-hrs-btn.ee-hrs-active {
            background: #1a4070;
            border-color: #4c9fef;
            color: #ffffff;
            font-weight: bold;
        }
    `);

    const STORAGE_KEY = 'ee_news_search_history';
    const HRS_KEY     = 'ee_news_last_hrs';
    const MAX_HISTORY_ITEMS = 15;
    const ABSOLUTE_MAX_LIMIT = 50;
    const HRS_PRESETS = [6, 12, 24, 48];

    // ── hrs persistence (single value) ──────────────────────────────────────

    function getLastHrs() {
        return localStorage.getItem(HRS_KEY) || '';
    }

    function saveLastHrs(hrs) {
        const val = String(hrs || '').trim();
        if (val) {
            localStorage.setItem(HRS_KEY, val);
        }
    }

    // ── country number history ──────────────────────────────────────────────

    function getHistory() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    // Normalize: accept plain strings or objects, return plain strings
                    return parsed.map(function(item) {
                        return typeof item === 'object' && item !== null
                            ? String(item.countryNum || '').trim()
                            : String(item).trim();
                    }).filter(function(s) {
                        return s.length > 0 && !isNaN(parseInt(s, 10));
                    });
                }
            }
        } catch (e) {
            console.error('[EE News History] Failed to parse history', e);
        }
        return [];
    }

    function saveHistory(history) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }

    function addToHistory(countryNum) {
        const cleaned = String(countryNum).trim();
        if (!cleaned || isNaN(parseInt(cleaned, 10))) {
            return;
        }
        let history = getHistory();
        history = history.filter(function(s) { return s !== cleaned; });
        history.unshift(cleaned);
        history = history.slice(0, Math.min(MAX_HISTORY_ITEMS, ABSOLUTE_MAX_LIMIT));
        saveHistory(history);
    }

    // ── history button bar ──────────────────────────────────────────────────

    function renderHistoryButtons(container, input, form) {
        container.innerHTML = '';

        const history = getHistory();
        if (history.length === 0) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'flex';

        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = 'Recent Searches:';
        container.appendChild(label);

        history.forEach(function(countryNum) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ee-history-btn';
            btn.textContent = countryNum;
            btn.addEventListener('click', function() {
                input.value = countryNum;
                if (typeof form.requestSubmit === 'function') {
                    form.requestSubmit();
                } else {
                    addToHistory(countryNum);
                    form.submit();
                }
            });
            container.appendChild(btn);
        });

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'ee-history-clear-btn';
        clearBtn.textContent = 'Clear';
        clearBtn.addEventListener('click', function() {
            saveHistory([]);
            renderHistoryButtons(container, input, form);
        });
        container.appendChild(clearBtn);
    }

    // ── hrs preset buttons ──────────────────────────────────────────────────

    let hrsPresetButtons = [];

    function updateHrsButtonStates(currentVal) {
        const num = parseInt(currentVal, 10);
        hrsPresetButtons.forEach(function(btn) {
            if (parseInt(btn.dataset.hrs, 10) === num) {
                btn.classList.add('ee-hrs-active');
            } else {
                btn.classList.remove('ee-hrs-active');
            }
        });
    }

    function injectHrsPresetButtons(hrsInput) {
        hrsPresetButtons = [];
        const wrapper = document.createElement('span');
        wrapper.style.marginLeft = '6px';
        wrapper.style.display = 'inline-flex';
        wrapper.style.gap = '4px';
        wrapper.style.verticalAlign = 'middle';

        HRS_PRESETS.forEach(function(val) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ee-hrs-btn';
            btn.dataset.hrs = val;
            btn.textContent = val + 'h';
            btn.title = 'Set hours back to ' + val;
            btn.addEventListener('click', function() {
                hrsInput.value = val;
                updateHrsButtonStates(val);
            });
            wrapper.appendChild(btn);
            hrsPresetButtons.push(btn);
        });

        hrsInput.parentNode.insertBefore(wrapper, hrsInput.nextSibling);

        // Keep active state in sync when user types manually
        hrsInput.addEventListener('input', function() {
            updateHrsButtonStates(hrsInput.value);
        });
    }

    // ── init ────────────────────────────────────────────────────────────────

    function init() {
        const input = document.querySelector('form[action*="news"] input[name="countrynum"]') ||
                      document.querySelector('input[name="countrynum"]');
        if (!input) {
            return;
        }

        const hrsInput = document.querySelector('form[action*="news"] input[name="hrs"]') ||
                         document.querySelector('input[name="hrs"]');

        const form = input.closest('form');
        if (!form) {
            return;
        }

        // Inject preset buttons and restore the last saved hrs value
        if (hrsInput) {
            injectHrsPresetButtons(hrsInput);

            const savedHrs = getLastHrs();
            if (savedHrs) {
                hrsInput.value = savedHrs;
            }
            updateHrsButtonStates(hrsInput.value);
        }

        // On submit: save hrs and record country number
        form.addEventListener('submit', function() {
            const hrs = hrsInput ? hrsInput.value.trim() : '';
            if (hrs) {
                saveLastHrs(hrs);
            }
            const val = input.value.trim();
            if (val) {
                addToHistory(val);
            }
        });

        // Auto-search via URL param ?ee_search_country=XX or #ee_search_country=XX
        const urlParams = new URLSearchParams(window.location.search);
        let autoSearchCountry = urlParams.get('ee_search_country');
        if (!autoSearchCountry && window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            autoSearchCountry = hashParams.get('ee_search_country');
        }

        if (autoSearchCountry) {
            const countryNum = autoSearchCountry.trim();
            if (countryNum && !isNaN(parseInt(countryNum, 10))) {
                input.value = countryNum;
                if (typeof form.requestSubmit === 'function') {
                    form.requestSubmit();
                } else {
                    addToHistory(countryNum);
                    form.submit();
                }
                return;
            }
        }

        // Create and render the history button bar above the form
        const container = document.createElement('div');
        container.id = 'ee-news-history-container';
        form.parentNode.insertBefore(container, form);
        renderHistoryButtons(container, input, form);
    }

    init();
})();
