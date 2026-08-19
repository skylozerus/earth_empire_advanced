// ==UserScript==
// @name         Earth Empires – Advisor Acres Extractor
// @namespace    https://github.com/local/ee-enhancer
// @version      1.0
// @description  Extracts built acres (Land minus Unused Lands) from the Advisor page and stores it in localStorage.
// @author       you
// @match        https://*.earthempires.com/*/advisor*
// @match        https://earthempires.com/*/advisor*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Locate all rows in tables of class "advisor"
    const rows = document.querySelectorAll('table.advisor tr');
    let land = null;
    let unusedLands = null;

    for (const row of rows) {
        const tds = row.querySelectorAll('td');
        if (tds.length >= 2) {
            const label = tds[0].textContent.trim();
            const valueText = tds[1].textContent.trim();

            // Normalize spacing/casing for robust matching
            const normalizedLabel = label.toLowerCase().replace(/\s+/g, ' ');

            if (normalizedLabel === 'land') {
                const parsed = parseInt(valueText.replace(/,/g, ''), 10);
                if (!isNaN(parsed)) {
                    land = parsed;
                }
            } else if (normalizedLabel === 'unused lands') {
                const parsed = parseInt(valueText.replace(/,/g, ''), 10);
                if (!isNaN(parsed)) {
                    unusedLands = parsed;
                }
            }
        }
    }

    if (land !== null && unusedLands !== null) {
        const builtAcres = land - unusedLands;
        localStorage.setItem('ee_my_acres', builtAcres);
        console.log(`[EE Advisor Extractor] Found Land: ${land}, Unused Lands: ${unusedLands}. Saved built acres to localStorage (ee_my_acres): ${builtAcres}`);
    } else {
        console.warn(`[EE Advisor Extractor] Could not find both Land (found: ${land}) and Unused Lands (found: ${unusedLands}) in table.advisor rows.`);
    }
})();
