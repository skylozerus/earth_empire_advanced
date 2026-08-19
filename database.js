/**
 * database.js
 * SQLite layer using better-sqlite3 (synchronous, fast, no async needed).
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {fs.mkdirSync(dataDir, { recursive: true });}

const db = new Database(path.join(dataDir, 'earthstats.db'));

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS spyops (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    captured_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

    -- Identity
    country_name        TEXT,
    country_number      INTEGER,
    government          TEXT,
    server_id           INTEGER,
    reset_id            INTEGER,

    -- Core stats (indexed for fast dashboard queries)
    acres               INTEGER,
    turns_taken         INTEGER,
    turns_left          INTEGER,
    turns_stored        INTEGER,
    rank                INTEGER,
    networth            INTEGER,
    money               INTEGER,
    population          INTEGER,
    at_war              INTEGER DEFAULT 0,
    gdi_member          INTEGER DEFAULT 0,
    last_turn_time      TEXT,

    -- Primary analysis target
    calc_ss_def_turrets REAL,
    calc_ss_def_label   TEXT,      -- exact field name from the spyop (may vary)

    -- Full data blobs (JSON strings)
    basics_json         TEXT,
    land_dist_json      TEXT,
    technology_json     TEXT,
    military_json       TEXT,

    -- Original HTML for future re-parsing
    raw_html            TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_gov        ON spyops(government);
  CREATE INDEX IF NOT EXISTS idx_captured   ON spyops(captured_at);
  CREATE INDEX IF NOT EXISTS idx_country    ON spyops(country_number, server_id, reset_id);
  CREATE INDEX IF NOT EXISTS idx_def        ON spyops(calc_ss_def_turrets);
`);

// ─── Queries ──────────────────────────────────────────────────────────────────

const stmts = {
    findDuplicate: db.prepare(`
    SELECT id FROM spyops
    WHERE country_number = @country_number
      AND turns_taken    = @turns_taken
      AND server_id      = @server_id
      AND reset_id       = @reset_id
    LIMIT 1
  `),

    insert: db.prepare(`
    INSERT INTO spyops (
      country_name, country_number, government, server_id, reset_id,
      acres, turns_taken, turns_left, turns_stored, rank,
      networth, money, population, at_war, gdi_member, last_turn_time,
      calc_ss_def_turrets, calc_ss_def_label,
      basics_json, land_dist_json, technology_json, military_json,
      raw_html
    ) VALUES (
      @country_name, @country_number, @government, @server_id, @reset_id,
      @acres, @turns_taken, @turns_left, @turns_stored, @rank,
      @networth, @money, @population, @at_war, @gdi_member, @last_turn_time,
      @calc_ss_def_turrets, @calc_ss_def_label,
      @basics_json, @land_dist_json, @technology_json, @military_json,
      @raw_html
    )
  `),

    deleteById: db.prepare('DELETE FROM spyops WHERE id = ?'),

    getById: db.prepare('SELECT * FROM spyops WHERE id = ?'),

    getGovernments: db.prepare(`
    SELECT government, COUNT(*) AS count
    FROM spyops
    WHERE government IS NOT NULL
    GROUP BY government
    ORDER BY government
  `),

    stats: db.prepare(`
    SELECT
      COUNT(*)                        AS total,
      COUNT(DISTINCT government)      AS gov_count,
      MAX(calc_ss_def_turrets)        AS max_def,
      MAX(captured_at)                AS latest
    FROM spyops
  `),
};

// ─── Exported functions ───────────────────────────────────────────────────────

function findDuplicate({ country_number, turns_taken, server_id, reset_id }) {
    return stmts.findDuplicate.get({ country_number, turns_taken, server_id, reset_id });
}

function saveSpyop(data) {
    // Ensure all expected columns are present (use null for missing)
    const row = {
        country_name: null, country_number: null, government: null,
        server_id: null, reset_id: null,
        acres: null, turns_taken: null, turns_left: null, turns_stored: null, rank: null,
        networth: null, money: null, population: null, at_war: 0, gdi_member: 0,
        last_turn_time: null, calc_ss_def_turrets: null, calc_ss_def_label: null,
        basics_json: null, land_dist_json: null, technology_json: null, military_json: null,
        raw_html: null,
        ...data,
    };
    const result = stmts.insert.run(row);
    return result.lastInsertRowid;
}

function getSpyops({ government, search, limit = 100, offset = 0 } = {}) {
    const conditions = [];
    const params     = [];

    if (government) { conditions.push('government = ?'); params.push(government); }
    if (search)     {
        conditions.push('(country_name LIKE ? OR government LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    return db.prepare(`
    SELECT id, captured_at, country_name, country_number, government,
           acres, turns_taken, rank, networth, money, population,
           calc_ss_def_turrets, at_war, gdi_member, last_turn_time
    FROM spyops ${where}
    ORDER BY captured_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
}

function getSpyopById(id) {
    return stmts.getById.get(id);
}

function deleteSpyop(id) {
    stmts.deleteById.run(id);
}

function getGovernments() {
    return stmts.getGovernments.all();
}

function getGlobalStats() {
    return stmts.stats.get();
}

function getDashboardData({ governments = [], dateFrom, dateTo } = {}) {
    const conditions = ['calc_ss_def_turrets IS NOT NULL'];
    const params     = [];

    if (governments.length > 0) {
        conditions.push(`government IN (${governments.map(() => '?').join(',')})`);
        params.push(...governments);
    }
    if (dateFrom) { conditions.push('captured_at >= ?'); params.push(dateFrom); }
    if (dateTo)   { conditions.push('captured_at <= ?'); params.push(dateTo + 'T23:59:59Z'); }

    const where = 'WHERE ' + conditions.join(' AND ');

    const timeSeries = db.prepare(`
    SELECT id, captured_at, government, country_name, country_number,
           calc_ss_def_turrets, acres, turns_taken, networth
    FROM spyops ${where}
    ORDER BY captured_at ASC
  `).all(...params);

    const aggregates = db.prepare(`
    SELECT government,
           COUNT(*)                    AS count,
           ROUND(AVG(calc_ss_def_turrets),2) AS avg_def,
           MIN(calc_ss_def_turrets)    AS min_def,
           MAX(calc_ss_def_turrets)    AS max_def,
           ROUND(AVG(acres))           AS avg_acres,
           MAX(captured_at)            AS latest_at
    FROM spyops ${where}
    GROUP BY government
    ORDER BY avg_def DESC
  `).all(...params);

    return { timeSeries, aggregates };
}

module.exports = {
    findDuplicate,
    saveSpyop,
    getSpyops,
    getSpyopById,
    deleteSpyop,
    getGovernments,
    getGlobalStats,
    getDashboardData,
};
