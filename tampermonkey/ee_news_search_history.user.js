// ==UserScript==
// @name         Earth Empires – News Search History
// @namespace    https://github.com/skylozerus/earth_empire_advanced
// @version      1.1
// @description  Saves the last 5 searched country numbers and adds quick-search buttons above the news form.
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
    `);

    const STORAGE_KEY = 'ee_news_search_history';
    const MAX_HISTORY_ITEMS = 15;
    const ABSOLUTE_MAX_LIMIT = 50;

    function getHistory() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    return parsed.filter(function(item) {
                        const str = String(item).trim();
                        return str.length > 0 && !isNaN(parseInt(str, 10));
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
        history = history.filter(function(item) {
            return String(item).trim() !== cleaned;
        });
        history.unshift(cleaned);

        const limit = Math.min(MAX_HISTORY_ITEMS, ABSOLUTE_MAX_LIMIT);
        history = history.slice(0, limit);
        saveHistory(history);
    }

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

    function init() {
        const input = document.querySelector('form[action*="news"] input[name="countrynum"]') ||
                      document.querySelector('input[name="countrynum"]');
        if (!input) {
            return;
        }

        const form = input.closest('form');
        if (!form) {
            return;
        }

        // Listen for standard form submits to record the search query
        form.addEventListener('submit', function() {
            const val = input.value.trim();
            if (val) {
                addToHistory(val);
            }
        });

        // Check if there is an auto-search country in the URL search params or hash
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

        // Create container for history buttons
        const container = document.createElement('div');
        container.id = 'ee-news-history-container';
        form.parentNode.insertBefore(container, form);

        // Render initial buttons
        renderHistoryButtons(container, input, form);
    }

    init();
})();
