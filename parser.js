/**
 * parser.js
 * Extracts structured data from Earth Empires spyop HTML.
 * Handles both:
 *   (a) Browser source-viewer format (chrome/firefox saved-source with line-number table)
 *   (b) Raw game HTML pasted directly
 */

const cheerio = require('cheerio');

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseNum(str) {
    if (!str && str !== 0) {return null;}
    const n = parseInt(String(str).replace(/[,\s$]/g, ''), 10);
    return isNaN(n) ? null : n;
}

function parseMoney(str) {
    if (!str) {return null;}
    const n = parseInt(String(str).replace(/[$,\s]/g, ''), 10);
    return isNaN(n) ? null : n;
}

function parseFloat2(str) {
    if (!str) {return null;}
    const n = parseFloat(String(str).replace(/[$,\s]/g, ''));
    return isNaN(n) ? null : n;
}

// ─── Browser source-viewer unwrap ───────────────────────────────────────────

function isBrowserSourceViewer(html) {
    return html.includes('class="line-content"') || html.includes("class='line-content'");
}

/**
 * The browser source viewer wraps each line of the original HTML in a
 * <td class="line-content"> element, with HTML tags represented as
 * syntax-highlighted <span> elements. cheerio's .text() decodes the spans
 * back to raw HTML text.
 */
function extractInnerHtml(outerHtml) {
    const $ = cheerio.load(outerHtml);
    const lines = [];
    $('td.line-content').each((_, el) => {
        lines.push($(el).text());
    });
    return lines.join('\n');
}

// ─── Table parser ────────────────────────────────────────────────────────────

/**
 * Parses a .advisor table into a key→value object.
 * Technology tables have 3 columns (name, points, percentage).
 */
function parseAdvisorTable($, table) {
    const rows = {};
    const isTech = $(table).find('th').first().text().trim() === 'Technology';

    $(table).find('tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 2) {return;}

        const key = $(cells.eq(0)).text().trim();
        if (!key) {return;}

        if (isTech && cells.length >= 3) {
            const pts  = $(cells.eq(1)).text().trim();
            const pct  = $(cells.eq(2)).text().trim();
            rows[key]           = `${pts} pts / ${pct}`;
            rows[`${key}_pts`]  = pts;
            rows[`${key}_pct`]  = pct;
        } else {
            // Use last td as the value (some rows have 2, some 3 cols)
            rows[key] = $(cells.eq(cells.length - 1)).text().trim();
        }
    });

    return rows;
}

// ─── Main parse function ─────────────────────────────────────────────────────

function parseSpyop(rawHtml) {
    // Step 1: unwrap browser source-viewer if necessary
    const innerHtml = isBrowserSourceViewer(rawHtml)
        ? extractInnerHtml(rawHtml)
        : rawHtml;

    const $ = cheerio.load(innerHtml);
    const result = {};

    // ── Country / Government ──────────────────────────────────────────────────
    // The game renders: "The Status of the <strong>Monarchy</strong> of
    //                   <strong>Vi (#13)</strong> - 0 mins ago"
    let headerText = '';
    $('span').each((_, el) => {
        const t = $(el).text();
        if (t.includes('The Status of the')) { headerText = t; return false; }
    });

    if (headerText) {
        const m = headerText.match(/The Status of the\s+(.+?)\s+of\s+(.+?)\s*\(#(\d+)\)/);
        if (m) {
            result.government    = m[1].trim();
            result.country_name  = m[2].trim();
            result.country_number = parseInt(m[3], 10);
        }
    }

    // Fallback: use <strong> tags
    if (!result.government) {
        const strongs = $('strong');
        if (strongs.length >= 2) {
            result.government = strongs.eq(0).text().trim();
            const raw = strongs.eq(1).text().trim();
            const m = raw.match(/^(.+?)\s*\(#(\d+)\)$/);
            if (m) {
                result.country_name   = m[1].trim();
                result.country_number = parseInt(m[2], 10);
            }
        }
    }

    // ── Hidden inputs (server / reset) ───────────────────────────────────────
    result.server_id = parseNum($('input[name="serverid"]').attr('value'));
    result.reset_id  = parseNum($('input[name="resetid"]').attr('value'));

    // ── Advisor tables ────────────────────────────────────────────────────────
    const basics    = {};
    const landDist  = {};
    const technology = {};
    const militaryAll = {};          // merged rows from all non-standard sections
    const sectionMap = {};           // header → rows  (for full JSON storage)

    $('table.advisor').each((_, table) => {
        const header = $(table).find('th').first().text().trim();
        const rows   = parseAdvisorTable($, table);
        sectionMap[header] = rows;

        switch (header) {
        case 'The Basics':       Object.assign(basics,    rows); break;
        case 'Land Distribution': Object.assign(landDist,  rows); break;
        case 'Technology':        Object.assign(technology, rows); break;
        default:
        // Military, Spy Forces, etc.
            Object.assign(militaryAll, rows);
            break;
        }
    });

    // ── Map core fields ───────────────────────────────────────────────────────
    result.acres        = parseNum(basics['Land']);
    result.turns_taken  = parseNum(basics['Turns Taken']);
    result.turns_left   = parseNum(basics['Turns Left']);
    result.turns_stored = parseNum(basics['Turns Stored']);
    result.rank         = parseNum(basics['Rank']);
    result.networth     = parseMoney(basics['Networth']);
    result.money        = parseMoney(basics['Money']);
    result.population   = parseNum(basics['Population']);
    result.at_war       = basics['At War']      === 'Yes' ? 1 : 0;
    result.gdi_member   = basics['GDI Member']  === 'Yes' ? 1 : 0;
    result.last_turn_time = basics['Last Turn Time'] || null;

    // ── Find Calc SS Def In Turrets ───────────────────────────────────────────
    // Search all sections for any row whose label mentions "ss def" or "turret"
    const searchPool = { ...basics, ...landDist, ...militaryAll };
    for (const [key, val] of Object.entries(searchPool)) {
        const kl = key.toLowerCase();
        if (kl.includes('ss def') || (kl.includes('def') && kl.includes('turret')) || kl.includes('turret def')) {
            result.calc_ss_def_turrets = parseFloat2(val);
            result.calc_ss_def_label   = key;   // store exact field label
            break;
        }
    }

    // ── JSON blobs for full storage ───────────────────────────────────────────
    result.basics_json     = JSON.stringify(basics);
    result.land_dist_json  = JSON.stringify(landDist);
    result.technology_json = JSON.stringify(technology);
    result.military_json   = JSON.stringify({ _merged: militaryAll, _sections: sectionMap });

    return result;
}

module.exports = { parseSpyop };
