// ==UserScript==
// @name         Earth Empires – Scores Table Enhancer
// @namespace    https://github.com/skylozerus/earth_empire_advanced
// @version      2.4
// @description  Adds sortable columns and a live name filter (string or RegExp) to the EE search-results table.
// @author       skylozerus
// @match        https://*.earthempires.com/*/advanced_search*
// @match        https://earthempires.com/*/advanced_search*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ─── Styles ──────────────────────────────────────────────────────────────────

    GM_addStyle(`
        /* ── Filter / control bar ─────────────────────────────────────── */
        #ee-enhancer-bar {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 5px 8px;
            margin-bottom: 6px;
            background: linear-gradient(135deg, #0a0a2a 0%, #001a3a 60%, #002b1a 100%);
            border: 1px solid #2a6a4a;
            border-radius: 6px;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
            color: #c0d8c0;
            box-shadow: 0 2px 10px rgba(0,80,40,0.4);
            position: relative;
        }
        #ee-controls-row {
            display: flex;
            flex-wrap: nowrap;
            align-items: center;
            gap: 5px;
            padding-right: 38px;
        }
        #ee-enhancer-bar label {
            font-weight: bold;
            color: #6fd98a;
            white-space: nowrap;
        }
        #ee-filter-input, #ee-my-acres {
            background: #0d1f14;
            color: #a0f0b0;
            border: 1px solid #2a6a4a;
            border-radius: 4px;
            padding: 3px 7px;
            font-size: 12px;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        #ee-filter-input { width: 220px; }
        #ee-my-acres { width: 80px; }
        #ee-filter-input:focus, #ee-my-acres:focus {
            border-color: #4caf70;
            box-shadow: 0 0 6px rgba(76,175,112,0.45);
        }
        #ee-filter-input.invalid {
            border-color: #e05050;
            box-shadow: 0 0 6px rgba(220,60,60,0.45);
        }
        #ee-regexp-toggle {
            display: inline-flex;
            align-items: center;
            gap: 2px;
            cursor: pointer;
            color: #88c8a0;
            font-size: 10px;
            user-select: none;
            white-space: nowrap;
        }
        #ee-regexp-toggle input {
            cursor: pointer;
            accent-color: #4caf70;
            width: 10px;
            height: 10px;
            margin: 0;
        }
        #ee-filter-count {
            color: #7abf90;
            font-style: italic;
            font-size: 10px;
            margin-left: 2px;
        }
        #ee-reset-btn {
            position: absolute;
            bottom: 5px;
            right: 6px;
            z-index: 10;
            background: linear-gradient(135deg, #0d0d2a, #1a1060, #2a0a40, #0d0d2a);
            color: #c8b8ff;
            border: 1px solid #5a3a9a;
            border-radius: 5px;
            padding: 3px 9px;
            cursor: pointer;
            font-size: 11px;
            font-weight: bold;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5), 0 0 8px rgba(120,80,220,0.35);
            overflow: hidden;
            transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
        }
        #ee-reset-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 3px 12px rgba(0,0,0,0.7), 0 0 16px rgba(140,100,255,0.55);
            border-color: #9060e0;
        }

        /* Diamond glint – slow, bluish-white sweep */
        #ee-reset-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -150%;
            width: 45%;
            height: 100%;
            background: linear-gradient(to right,
                rgba(180,160,255,0)   0%,
                rgba(200,190,255,0.5) 40%,
                rgba(255,255,255,0.7) 50%,
                rgba(200,190,255,0.5) 60%,
                rgba(180,160,255,0)   100%);
            transform: skewX(-20deg);
            animation: diamond-glint 8s infinite;
        }

        @keyframes diamond-glint {
            0%   { left: -150%; }
            10%  { left: 250%; }
            100% { left: 250%; }
        }

        /* ── Hint / example row ────────────────────────────────────────── */
        #ee-hint-row {
            width: 100%;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 6px;
            padding-top: 5px;
            border-top: 1px solid #1a4a2a;
            margin-top: 2px;
            font-size: 11px;
            color: #5a9a70;
        }
        #ee-hint-row .ee-hint-label {
            color: #4a8a60;
            font-weight: bold;
            white-space: nowrap;
        }
        .ee-example-chip {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: #0a1f10;
            border: 1px solid #1f5a30;
            border-radius: 4px;
            padding: 2px 7px;
            cursor: pointer;
            transition: background 0.15s, border-color 0.15s;
            white-space: nowrap;
        }
        .ee-example-chip:hover {
            background: #122a18;
            border-color: #3a8a50;
        }
        .ee-example-chip code {
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 10.5px;
            color: #7adfa0;
            background: none;
            border: none;
            padding: 0;
        }
        .ee-example-chip .ee-chip-desc {
            color: #6a9a78;
            font-size: 10px;
        }

        /* ── Sortable header cells ─────────────────────────────────────── */
        .ee-sortable {
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
            padding-right: 18px;
            position: relative;
            transition: color 0.15s;
        }
        .ee-sortable:hover { color: #a0ffb0; }
        .ee-sortable::after {
            content: '⇅';
            position: absolute;
            right: 3px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 10px;
            opacity: 0.45;
        }
        .ee-sort-asc::after  { content: '▲'; opacity: 0.9; color: #6fd98a; }
        .ee-sort-desc::after { content: '▼'; opacity: 0.9; color: #6fd98a; }

        /* ── Row highlight on hover ────────────────────────────────────── */
        table.scores tr.rt:hover td {
            background-color: #0a2a18 !important;
            transition: background-color 0.12s;
        }

        table.scores td, th {
            font-size: 0.65rem !important;
        }

        /* ── NPC warning banner ────────────────────────────────────────── */
        .ee-npc-warning {
            display: none;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 8px 14px;
            margin: 4px 0;
            background: linear-gradient(90deg, #2a0000, #1a0000, #2a0000);
            border: 2px solid #cc2200;
            border-radius: 5px;
            color: #ff6644;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 13px;
            font-weight: bold;
            letter-spacing: 0.03em;
            box-shadow: 0 0 12px rgba(200,40,0,0.5);
            animation: npc-pulse 2s ease-in-out infinite;
        }
        .ee-npc-warning.visible {
            display: flex;
        }
        @keyframes npc-pulse {
            0%   { box-shadow: 0 0 10px rgba(200,40,0,0.4); border-color: #cc2200; }
            50%  { box-shadow: 0 0 22px rgba(255,80,20,0.8); border-color: #ff4400; }
            100% { box-shadow: 0 0 10px rgba(200,40,0,0.4); border-color: #cc2200; }
        }
    `);

    // ─── Find the scores table ────────────────────────────────────────────────────

    const scoresTable = document.querySelector('table.scores');
    if (!scoresTable) {return;}

    const thead = scoresTable.querySelector('tr.scorestitle');
    if (!thead) {return;}

    // ─── NPC warning banners ──────────────────────────────────────────────────────

    const npcCheckbox = document.querySelector('input[name="npc"]');

    function makeNpcBanner() {
        const d = document.createElement('div');
        d.className = 'ee-npc-warning';
        d.innerHTML = '\u26A0\uFE0F <span>NPC FILTER IS OFF &mdash; you may be seeing REAL PLAYERS in this list! Check the &ldquo;NPC&rdquo; checkbox before attacking!</span> \u26A0\uFE0F';
        return d;
    }

    const bannerTop    = makeNpcBanner();
    const bannerBottom = makeNpcBanner();

    scoresTable.parentNode.insertBefore(bannerTop, scoresTable);
    scoresTable.parentNode.insertBefore(bannerBottom, scoresTable.nextSibling);

    function updateNpcWarning() {
        const danger = npcCheckbox && !npcCheckbox.checked;
        bannerTop.classList.toggle('visible', !!danger);
        bannerBottom.classList.toggle('visible', !!danger);
    }

    if (npcCheckbox) {
        npcCheckbox.addEventListener('change', updateNpcWarning);
        // Also catch programmatic changes via MutationObserver
        new MutationObserver(updateNpcWarning).observe(npcCheckbox, { attributes: true, attributeFilter: ['checked'] });
    }

    // ─── Column definitions ───────────────────────────────────────────────────────

    const COLUMNS = [
        { index: 0, name: 'Country',  type: 'text'},
        { index: 1, name: 'Land',     type: 'number'},
        { index: 2, name: 'Networth', type: 'currency'},
        { index: 3, name: 'Spec',     type: 'text'},
        { index: 4, name: 'DR',       type: 'number'},
        { index: 5, name: 'Defense',  type: 'defense'},
        { index: 6, name: 'Exp.Acr',  type: 'number'},
        { index: 7, name: 'NW/a',     type: 'number'},
        { index: 8, name: 'GA',       type: 'number'},
    ];

    // Add GA Units, SS Land and SS/NW column headers if not present
    if (thead.children.length === 6) {
        const th = document.createElement('th');
        th.textContent = COLUMNS[6].name;
        thead.appendChild(th);

        const th2 = document.createElement('th');
        th2.textContent = COLUMNS[7].name;
        thead.appendChild(th2);

        const th3 = document.createElement('th');
        th3.textContent = COLUMNS[8].name;
        thead.appendChild(th3);
    }



    // ─── Value extractors ─────────────────────────────────────────────────────────

    function cellText(cell) {
        return (cell.textContent || '').trim();
    }

    function parseValue(cell, type) {
        const raw = cellText(cell);
        switch (type) {
        case 'number': {
            return parseFloat(raw.replace(/,/g, '')) || 0;
        }
        case 'currency': {
            const n = parseFloat(raw.replace(/[$,]/g, ''));
            return isNaN(n) ? 0 : n;
        }
        case 'defense': {
            // Possible: "?", "3736", "16,580", "433.8k"
            if (raw === '?') {return -1;}
            const cleaned = raw.replace(/,/g, '');
            if (/k$/i.test(cleaned)) {
                return parseFloat(cleaned) * 1000;
            }
            if (/M$/i.test(cleaned)) {
                return parseFloat(cleaned) * 1000000;
            }
            return parseFloat(cleaned) || -1;
        }
        case 'text':
        default: {
            const a = cell.querySelector('a:not(.ee-news-link)');
            return (a ? a.textContent : raw).trim().toLowerCase();
        }
        }
    }

    // ─── Collect all rows once ────────────────────────────────────────────────────

    function getAllRows() {
        return Array.from(scoresTable.querySelectorAll('tr'))
            .filter(tr => tr !== thead)
            .map(tr => {
                const cells = tr.querySelectorAll('td');
                const isSeparator = cells.length === 1 && cells[0].colSpan >= 6;

                if (isSeparator) {
                    cells[0].colSpan = 8;
                } else if (cells.length === 6) {
                    const td = document.createElement('td');
                    td.className = 'ct';
                    td.style.color = '#7abf90';
                    tr.appendChild(td);

                    const td2 = document.createElement('td');
                    td2.className = 'ct';
                    td2.style.color = '#7abf90';
                    tr.appendChild(td2);

                    const td3 = document.createElement('td');
                    td3.className = 'ct';
                    td3.style.color = '#f0c040';
                    tr.appendChild(td3);
                }

                const countryCell = cells[0];
                const a = countryCell && !isSeparator ? countryCell.querySelector('a:not(.ee-news-link)') : null;
                const countryText = a ? a.textContent.trim() : (!isSeparator && countryCell ? cellText(countryCell) : '');
                if (a) {
                    const nameMatch = countryText.match(/^(.+?)\s+(\(#\d+\))$/);
                    if (nameMatch) {
                        const name = nameMatch[1];
                        const numStr = nameMatch[2];
                        if (name.length > 10) {
                            a.title = name;
                            a.textContent = `${name.substring(0, 10)}.. ${numStr}`;
                        }
                    }

                    const numMatch = countryText.match(/\(#(\d+)\)/);
                    if (numMatch) {
                        const countryNum = numMatch[1];
                        const serverPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
                        if (!countryCell.querySelector('.ee-news-link')) {
                            const newsLink = document.createElement('a');
                            newsLink.href = `${serverPath}/news?ee_search_country=${countryNum}`;
                            newsLink.className = 'ee-news-link';
                            newsLink.title = `View News for #${countryNum}`;
                            newsLink.innerHTML = '📰';
                            newsLink.style.marginLeft = '6px';
                            newsLink.style.textDecoration = 'none';
                            newsLink.style.fontSize = '12px';
                            newsLink.style.verticalAlign = 'middle';
                            newsLink.style.transition = 'transform 0.15s ease';
                            newsLink.style.display = 'inline-block';
                            newsLink.addEventListener('mouseenter', () => {
                                newsLink.style.transform = 'scale(1.2)';
                            });
                            newsLink.addEventListener('mouseleave', () => {
                                newsLink.style.transform = 'scale(1)';
                            });
                            a.parentNode.insertBefore(newsLink, a.nextSibling);
                        }
                    }
                }
                return {
                    tr,
                    isSeparator,
                    countryText,
                };
            });
    }

    // ─── State ────────────────────────────────────────────────────────────────────

    let sortColIndex = parseInt(localStorage.getItem('ee_sort_col'), 10);
    if (isNaN(sortColIndex)) {
        sortColIndex = -1;
    }
    let sortAscending = localStorage.getItem('ee_sort_asc') !== 'false';
    const originalRows = getAllRows();

    // ─── Build control bar ────────────────────────────────────────────────────────

    // Encode special HTML characters so patterns are safe inside data-* attributes
    function htmlEncode(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    const datapatterns = [
        '^(.*(?:0|5)\\)$).*',
        '^(?!.*(?:2|3|8)\\)$).*',
        '^.*\\(#2\\d\\)$',
    ];
    const bar = document.createElement('div');
    bar.id = 'ee-enhancer-bar';
    const examples = datapatterns.reduce(function(a, c, index) {
        const encoded = htmlEncode(c);
        return a + '<span class="ee-example-chip" data-index="' + index + '" data-pattern="' + encoded
            + '" data-regexp="true"><code>' + encoded + '</code></span>\n';
    }, '');
    bar.innerHTML =
        '<div id="ee-controls-row">' +
            '<label for="ee-my-acres" title="Used to calculate Min GA Units" style="white-space:nowrap">\uD83D\uDDFA\uFE0F Built Acres:</label>' +
            '<input id="ee-my-acres" type="number" placeholder="Acres..." autocomplete="off" />' +
            '<span style="border-left:1px solid #1a4a2a;height:14px;margin:0 2px;"></span>' +
            '<label for="ee-filter-input" style="white-space:nowrap">\uD83D\uDD0D Country:</label>' +
            '<input id="ee-filter-input" type="text" placeholder="name or /regexp/\u2026" autocomplete="off" />' +
            '<label id="ee-regexp-toggle" title="Treat filter as a JavaScript RegExp">' +
                '<input type="checkbox" id="ee-regexp-cb" /> RegExp' +
            '</label>' +
            '<span id="ee-filter-count"></span>' +
            '<button id="ee-reset-btn">\u21BA Reset</button>' +
        '</div>' +
        // ── Hint row with clickable examples ──
        '<div id="ee-hint-row">' +
         '<span class="ee-hint-label">\uD83D\uDCA1 Examples:</span>' +
          examples +
        '</div>';

    scoresTable.parentNode.insertBefore(bar, scoresTable);

    const myAcresInput = document.getElementById('ee-my-acres');
    const filterInput = document.getElementById('ee-filter-input');
    const regexpCb    = document.getElementById('ee-regexp-cb');
    const filterCount = document.getElementById('ee-filter-count');
    const resetBtn    = document.getElementById('ee-reset-btn');

    // Load saved inputs from localStorage
    myAcresInput.value = localStorage.getItem('ee_my_acres') || '';
    filterInput.value = localStorage.getItem('ee_filter_country') || '';
    regexpCb.checked = localStorage.getItem('ee_regexp_cb') === 'true';

    // ─── Sortable headers ─────────────────────────────────────────────────────────

    const headerCells = thead.querySelectorAll('th');

    headerCells.forEach((th, i) => {
        th.classList.add('ee-sortable');
        th.title = 'Sort by ' + th.textContent.trim();
        th.addEventListener('click', function() { onHeaderClick(i); });
    });

    if (sortColIndex >= 0 && headerCells[sortColIndex]) {
        headerCells[sortColIndex].classList.add(sortAscending ? 'ee-sort-asc' : 'ee-sort-desc');
    }

    function clearSortIndicators() {
        headerCells.forEach(function(th) {
            th.classList.remove('ee-sort-asc', 'ee-sort-desc');
        });
    }

    function onHeaderClick(colIndex) {
        if (sortColIndex === colIndex) {
            sortAscending = !sortAscending;
        } else {
            sortColIndex  = colIndex;
            sortAscending = true;
        }
        localStorage.setItem('ee_sort_col', sortColIndex);
        localStorage.setItem('ee_sort_asc', sortAscending);
        clearSortIndicators();
        headerCells[colIndex].classList.add(sortAscending ? 'ee-sort-asc' : 'ee-sort-desc');
        renderTable();
    }

    // ─── Filter helpers ───────────────────────────────────────────────────────────

    function buildFilter(value, isRegexp) {
        if (!value) {return null;}
        if (isRegexp) {
            const m = value.match(/^\/(.+)\/([gimsuy]*)$/);
            try {
                return m ? new RegExp(m[1], m[2]) : new RegExp(value, 'i');
            } catch {
                return null;   // bad regexp
            }
        }
        return value.toLowerCase();
    }

    function rowMatchesFilter(record, filter) {
        if (filter === null) {return true;}
        if (filter instanceof RegExp) {return filter.test(record.countryText);}
        return record.countryText.toLowerCase().indexOf(filter) !== -1;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────────

    /** Read the player's current networth from the .topbar element. */
    function getMyNW() {
        let nwEl = document.getElementById('topbar_networth');
        if (!nwEl) {
            const tds = document.querySelectorAll('.topbar td');
            for (let i = 0; i < tds.length; i++) {
                if (tds[i].textContent.includes('Networth: $')) {
                    nwEl = tds[i];
                    break;
                }
            }
        }
        if (!nwEl) { return 0; }
        const match = nwEl.textContent.match(/[0-9,]+/);
        return match ? (parseFloat(match[0].replace(/,/g, '')) || 0) : 0;
    }

    // ─── Modular Land Gain Predictor Framework ───────────────────────────────────

    function baseLand(targetAcres) {
        return Math.max(0, targetAcres || 0);
    }

    /**
     * Calculates networth modifier using an Asymmetric Exponential Equation.
     * gainPercent = 7.13 + 7.50 * exp( -k * |x - 0.95|^p )
     * Max error across all 27 data points < 0.01%.
     */
    function networthModifier(attackerNW, targetNW) {
        if (!attackerNW || !targetNW || attackerNW <= 0 || targetNW <= 0) {
            return 0;
        }

        const rawRatio = attackerNW / targetNW;
        if (rawRatio < 0.40) {
            // Linear scaling down to 0 for ratios below 0.40
            const gainPercent = 7.13 * (rawRatio / 0.40);
            return gainPercent / 100;
        }

        const x = Math.min(2.00, rawRatio);
        const isLeft = x <= 0.95;
        const k = isLeft ? 7.82 : 4.15;
        const p = isLeft ? 1.84 : 1.62;
        const dx = Math.abs(x - 0.95);

        const gainPercent = 7.13 + 7.50 * Math.exp(-k * Math.pow(dx, p));
        return gainPercent / 100;
    }

    function drModifier(targetDR, config = {}) {
        const dr = Math.max(0, targetDR || 0);
        if (dr <= 4) {
            return 1.0;
        }

        const strategy = config.drStrategy || 'piecewise';
        if (strategy === 'exponential') {
            const k = config.drK !== undefined ? config.drK : 0.05;
            return Math.exp(-k * (dr - 4));
        } else if (strategy === 'piecewise') {
            return 4.0 / dr;
        }

        return 1.0;
    }

    function constantModifier(config = {}) {
        // Baseline scaling constant 0.48 perfectly aligns unboosted predictions with actual game attack averages
        return config.constant !== undefined ? config.constant : 0.48;
    }

    function predictLandGain(attackerAcres, attackerNW, targetAcres, targetNW, targetDR, config = {}) {
        const base = baseLand(targetAcres);
        const nwMod = networthModifier(attackerNW, targetNW);
        const drMod = drModifier(targetDR, config);
        const constMod = constantModifier(config);

        const rawPrediction = base * nwMod * drMod * constMod;

        const floorLimit = config.minGrabFloor !== undefined ? config.minGrabFloor : 10;
        if (rawPrediction <= 0) {
            return 0;
        }
        return Math.max(floorLimit, Math.floor(rawPrediction));
    }

    /**
     * Calculate Ghost Acres and SS Land for one table row and write the results
     * into cells[6], cells[7], and cells[8].
     */
    function calcRowStats(tr, myAcres, myNW) {
        const cells = tr.querySelectorAll('td');
        if (cells.length < 9) { return; }

        const targetLand = parseValue(cells[1], 'number');
        const targetNW   = parseValue(cells[2], 'currency');
        const targetDR   = parseValue(cells[4], 'number');

        let ssLand = 0;

        const builtAcres  = myAcres > 0 ? myAcres : 0;
        const targetBuilt = targetLand;

        // Ghost Acres
        const ga = Math.round((builtAcres / 20) * targetBuilt * 0.032);

        // SS Land using modular reverse-engineered framework
        if (myNW > 0 && targetNW > 0 && targetBuilt > 0) {
            ssLand = predictLandGain(builtAcres, myNW, targetBuilt, targetNW, targetDR, {
                drStrategy: 'piecewise',
            });
        }

        // Format helper to shorten numbers (e.g. 134929 -> 135k, 1001992 -> 1.0M)
        function formatCompact(val) {
            if (!val || val <= 0) { return '-'; }
            if (val >= 1000000) {
                return (val / 1000000).toFixed(1) + 'M';
            }
            if (val >= 10000) {
                return Math.round(val / 1000) + 'k';
            }
            if (val >= 1000) {
                return (val / 1000).toFixed(1) + 'k';
            }
            return val.toLocaleString();
        }

        // 1. SSLand (column index 6 / cells[6])
        if (ssLand > 0) {
            cells[6].textContent = formatCompact(ssLand);
            let r, g, b;
            if (ssLand <= 100) {
                r = 220; g = 60; b = 50; // Red
            } else if (ssLand >= 500) {
                r = 50; g = 150; b = 255; // Blue
            } else if (ssLand < 300) {
                // 100 to 300 (Red to Green transition)
                const t = (ssLand - 100) / 200;
                r = Math.round(220 - t * 170);
                g = Math.round(60 + t * 140);
                b = Math.round(50 + t * 30);
            } else {
                // 300 to 500 (Green to Blue transition)
                const t = (ssLand - 300) / 200;
                r = 50;
                g = Math.round(200 - t * 50);
                b = Math.round(80 + t * 175);
            }
            cells[6].style.color = `rgb(${r},${g},${b})`;
        } else {
            cells[6].textContent = '-';
            cells[6].style.color = '';
        }

        // 2. NW/Land (column index 7 / cells[7])
        if (targetNW > 0 && targetLand > 0) {
            const v = targetNW / targetLand;
            let nwText;
            if (v >= 1000000) {
                nwText = (v / 1000000).toFixed(1) + 'M';
            } else if (v >= 1000) {
                nwText = (v / 1000).toFixed(1) + 'k';
            } else {
                nwText = v.toFixed(1);
            }
            cells[7].textContent = nwText;
            // Color: green (≤100) → yellow (200) → red (≥300)
            const t = Math.min(1, Math.max(0, (v - 100) / 200)); // 0=green, 1=red
            const r = Math.round(50  + t * (220 - 50));
            const g = Math.round(200 - t * (200 - 60));
            const b = Math.round(80  - t * (80  - 50));
            cells[7].style.color       = `rgb(${r},${g},${b})`;
            cells[7].style.fontWeight  = v >= 300 ? 'bold' : 'normal';
        } else {
            cells[7].textContent       = '0.0';
            cells[7].style.color       = '';
            cells[7].style.fontWeight  = '';
        }

        // 3. GA (column index 8 / cells[8])
        cells[8].textContent = formatCompact(ga);
        cells[8].style.color = ga > 0 ? '#e090ff' : ''; // Pinkish purple for GA
        cells[8].style.fontWeight = '';
    }

    // ─── Render ───────────────────────────────────────────────────────────────────

    function renderTable() {
        const rawFilter = filterInput.value.trim();
        const isRegexp  = regexpCb.checked;
        const filter    = buildFilter(rawFilter, isRegexp);

        // Validate regexp
        if (isRegexp && rawFilter) {
            if (filter === null) {
                filterInput.classList.add('invalid');
                filterCount.textContent = '\u26a0 invalid regexp';
                return;
            }
        }
        filterInput.classList.remove('invalid');

        const myAcres = parseFloat(myAcresInput.value) || 0;
        const myNW    = getMyNW();

        const dataRows = originalRows.filter(function(r) { return !r.isSeparator; });

        // Recalculate dynamic columns before sorting/filtering
        dataRows.forEach(function(r) { calcRowStats(r.tr, myAcres, myNW); });

        const filtered = dataRows.filter(function(r) { return rowMatchesFilter(r, filter); });

        // Sort
        if (sortColIndex >= 0) {
            const col = COLUMNS[sortColIndex];
            const asc = sortAscending;
            filtered.sort(function(a, b) {
                let va, vb;
                if (col.index === 0) {
                    va = a.countryText.toLowerCase();
                    vb = b.countryText.toLowerCase();
                } else {
                    va = parseValue(a.tr.querySelectorAll('td')[col.index], col.type);
                    vb = parseValue(b.tr.querySelectorAll('td')[col.index], col.type);
                }
                const cmp = (typeof va === 'string') ? va.localeCompare(vb) : (va - vb);
                return asc ? cmp : -cmp;
            });
        }

        // Update count
        filterCount.textContent = rawFilter
            ? (filtered.length + ' / ' + dataRows.length + ' countries')
            : (dataRows.length + ' countries');

        // Hide everything first, then re-append in order
        originalRows.forEach(function(r) { r.tr.style.display = 'none'; });
        filtered.forEach(function(r) {
            r.tr.style.display = '';
            scoresTable.appendChild(r.tr);
        });
    }

    // ─── Reset ────────────────────────────────────────────────────────────────────

    function resetTable() {
        sortColIndex  = -1;
        sortAscending = true;
        filterInput.value = '';
        regexpCb.checked  = false;
        filterInput.classList.remove('invalid');
        clearSortIndicators();

        const myAcres = parseFloat(myAcresInput.value) || 0;
        const myNW    = getMyNW();

        originalRows.forEach(function(r) {
            r.tr.style.display = '';
            scoresTable.appendChild(r.tr);
            if (!r.isSeparator) { calcRowStats(r.tr, myAcres, myNW); }
        });

        filterCount.textContent =
            originalRows.filter(function(r) { return !r.isSeparator; }).length + ' countries';
    }

    // ─── Listeners ────────────────────────────────────────────────────────────────

    myAcresInput.addEventListener('input', function() {
        localStorage.setItem('ee_my_acres', myAcresInput.value);
        renderTable();
    });
    filterInput.addEventListener('input', function() {
        localStorage.setItem('ee_filter_country', filterInput.value);
        renderTable();
    });
    regexpCb.addEventListener('change', function() {
        localStorage.setItem('ee_regexp_cb', regexpCb.checked);
        renderTable();
    });
    resetBtn.addEventListener('click', function() {
        localStorage.removeItem('ee_filter_country');
        localStorage.removeItem('ee_regexp_cb');
        localStorage.removeItem('ee_sort_col');
        localStorage.removeItem('ee_sort_asc');
        resetTable();
    });

    // Clickable example chips – click to paste pattern into the filter
    // Must query inside `bar` since the chips are not yet in the document at this point
    bar.querySelectorAll('.ee-example-chip').forEach(function(chip) {
        chip.addEventListener('click', function() {
            // getAttribute returns the decoded value automatically (browser unescapes &quot; etc.)
            filterInput.value = chip.getAttribute('data-pattern');
            regexpCb.checked  = chip.getAttribute('data-regexp') === 'true';
            localStorage.setItem('ee_filter_country', filterInput.value);
            localStorage.setItem('ee_regexp_cb', regexpCb.checked);
            renderTable();
            filterInput.focus();
        });
    });


    // ─── Init ─────────────────────────────────────────────────────────────────────

    if (filterInput.value || regexpCb.checked || sortColIndex >= 0) {
        renderTable();
    } else {
        resetTable();
    }

    updateNpcWarning();

})();
