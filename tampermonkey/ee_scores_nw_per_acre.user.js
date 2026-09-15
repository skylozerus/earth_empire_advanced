// ==UserScript==
// @name         Earth Empires – Scores NW/Acre & News Link
// @namespace    https://github.com/skylozerus/earth_empire_advanced
// @version      1.1
// @description  Adds Networth per acre ratio column, news history links, and a searchable Special header field to the EE scores page.
// @author       skylozerus
// @match        https://*.earthempires.com/*/scores*
// @match        https://earthempires.com/*/scores*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Inject CSS styles for news links and special header filter input
    const style = document.createElement('style');
    style.textContent = `
        .ee-news-link {
            margin-left: 6px;
            text-decoration: none;
            font-size: 12px;
            vertical-align: middle;
            display: inline-block;
            transition: transform 0.15s ease;
        }
        .ee-news-link:hover {
            transform: scale(1.2);
        }
        #ee-special-filter {
            width: 55px;
            background: #000020;
            color: #FFEECC;
            border: 1px solid #4a6a8a;
            border-radius: 3px;
            text-align: center;
            font-size: 11px;
            font-weight: bold;
            padding: 1px 3px;
            outline: none;
            box-sizing: border-box;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        #ee-special-filter:focus {
            border-color: #6fd98a;
            box-shadow: 0 0 5px rgba(111, 217, 138, 0.6);
        }
        #ee-special-filter::placeholder {
            color: #ffffff;
            opacity: 0.9;
            font-weight: normal;
        }
    `;
    document.head.appendChild(style);

    function init() {
        const titleRow = document.querySelector('table.scores tr.scorestitle');
        if (!titleRow) {
            return;
        }

        const scoresTable = titleRow.closest('table');
        if (!scoresTable) {
            return;
        }

        // Check if NW/a header already exists
        const headerCells = Array.from(titleRow.children);
        let nwHeaderIndex = -1;
        headerCells.forEach(function(cell, idx) {
            if (cell.textContent.trim() === 'NW/a') {
                nwHeaderIndex = idx;
            }
        });

        if (nwHeaderIndex === -1) {
            // Find Networth column index (default is 3)
            let nwColIndex = -1;
            headerCells.forEach(function(cell, idx) {
                if (cell.textContent.trim().toLowerCase() === 'networth') {
                    nwColIndex = idx;
                }
            });

            const thNW = document.createElement('td');
            thNW.textContent = 'NW/a';
            if (nwColIndex !== -1 && nwColIndex + 1 < headerCells.length) {
                titleRow.insertBefore(thNW, headerCells[nwColIndex + 1]);
                nwHeaderIndex = nwColIndex + 1;
            } else {
                titleRow.appendChild(thNW);
                nwHeaderIndex = headerCells.length;
            }
        }

        // Convert "Special" header into a searchable input field
        const updatedHeaderCells = Array.from(titleRow.children);
        let specialColIndex = -1;
        let specialInput = null;

        updatedHeaderCells.forEach(function(cell, idx) {
            const text = cell.textContent.trim().toLowerCase();
            if (text === 'special' || cell.querySelector('#ee-special-filter')) {
                specialColIndex = idx;
                specialInput = cell.querySelector('#ee-special-filter');
                if (!specialInput) {
                    cell.textContent = '';
                    specialInput = document.createElement('input');
                    specialInput.type = 'text';
                    specialInput.id = 'ee-special-filter';
                    specialInput.placeholder = 'Special';
                    specialInput.autocomplete = 'off';
                    cell.appendChild(specialInput);
                }
            }
        });

        const serverPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
        const rows = Array.from(scoresTable.querySelectorAll('tr'));

        rows.forEach(function(tr) {
            if (tr === titleRow) {
                return;
            }

            const cells = Array.from(tr.querySelectorAll('td'));
            if (cells.length === 0) {
                return;
            }

            // Handle separator rows
            if (cells.length === 1) {
                cells[0].colSpan = 6;
                return;
            }

            // Country cell is column index 1
            const countryCell = cells[1];
            if (countryCell) {
                const countryText = countryCell.textContent.trim();
                const numMatch = countryText.match(/\(#(\d+)\)/);
                if (numMatch && !countryCell.querySelector('.ee-news-link')) {
                    const countryNum = numMatch[1];
                    const newsLink = document.createElement('a');
                    newsLink.href = `${serverPath}/news?ee_search_country=${countryNum}`;
                    newsLink.className = 'ee-news-link';
                    newsLink.title = `View News for #${countryNum}`;
                    newsLink.innerHTML = '📰';
                    countryCell.appendChild(newsLink);
                }
            }

            // Parse Land (column 2) and Networth (column 3)
            const landCell = cells[2];
            const networthCell = cells[3];

            if (landCell && networthCell) {
                const landText = landCell.textContent.trim();
                const land = parseFloat(landText.replace(/,/g, '')) || 0;

                const nwText = networthCell.textContent.trim();
                const nw = parseFloat(nwText.replace(/[$,]/g, '')) || 0;

                let ratioText = '0.0';
                let color = '';
                let fontWeight = 'normal';

                if (land > 0 && nw > 0) {
                    const v = nw / land;
                    if (v >= 1000000) {
                        ratioText = (v / 1000000).toFixed(1) + 'M';
                    } else if (v >= 1000) {
                        ratioText = (v / 1000).toFixed(1) + 'k';
                    } else {
                        ratioText = v.toFixed(1);
                    }

                    // Color transition: green (<=100) -> yellow (200) -> red (>=300)
                    const t = Math.min(1, Math.max(0, (v - 100) / 200));
                    const r = Math.round(50 + t * (220 - 50));
                    const g = Math.round(200 - t * (200 - 60));
                    const b = Math.round(80 - t * (80 - 50));
                    color = `rgb(${r},${g},${b})`;
                    if (v >= 300) {
                        fontWeight = 'bold';
                    }
                }

                // Check if NW/a cell was already added to this row
                let ratioCell = null;
                if (cells.length > 5 && cells[nwHeaderIndex]) {
                    ratioCell = cells[nwHeaderIndex];
                }

                if (!ratioCell) {
                    ratioCell = document.createElement('td');
                    ratioCell.className = 'rt';
                    if (nwHeaderIndex < cells.length) {
                        tr.insertBefore(ratioCell, cells[nwHeaderIndex]);
                    } else {
                        tr.appendChild(ratioCell);
                    }
                }

                ratioCell.textContent = ratioText;
                ratioCell.style.color = color;
                ratioCell.style.fontWeight = fontWeight;
            }
        });

        // Special column filter logic
        function applySpecialFilter() {
            if (!specialInput || specialColIndex === -1) {
                return;
            }
            const query = specialInput.value.trim().toLowerCase();

            rows.forEach(function(tr) {
                if (tr === titleRow) {
                    return;
                }

                const cells = Array.from(tr.querySelectorAll('td'));
                if (cells.length === 0) {
                    return;
                }

                // Separator rows
                if (cells.length === 1) {
                    tr.style.display = query ? 'none' : '';
                    return;
                }

                const specialCell = cells[specialColIndex] || cells[cells.length - 1];
                if (!specialCell) {
                    return;
                }

                const specialText = specialCell.textContent.trim().toLowerCase();
                if (!query || specialText.indexOf(query) !== -1) {
                    tr.style.display = '';
                } else {
                    tr.style.display = 'none';
                }
            });
        }

        if (specialInput) {
            const savedFilter = localStorage.getItem('ee_special_filter') || '';
            specialInput.value = savedFilter;

            specialInput.addEventListener('input', function() {
                localStorage.setItem('ee_special_filter', specialInput.value);
                applySpecialFilter();
            });

            if (savedFilter) {
                applySpecialFilter();
            }

            // Swap placeholder between "Special" and "Search" every 3 seconds
            setInterval(function() {
                specialInput.placeholder = specialInput.placeholder === 'Special' ? 'Search' : 'Special';
            }, 3000);
        }
    }

    init();
})();
