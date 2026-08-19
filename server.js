/**
 * server.js
 * Express backend for Earth Stats — serves the frontend and provides REST API.
 */

const express = require('express');
const path    = require('path');
const db      = require('./database');
const { parseSpyop } = require('./parser');

const app  = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── API routes ───────────────────────────────────────────────────────────────

// POST /api/parse — parse HTML, return extracted fields (preview, no DB write)
app.post('/api/parse', (req, res) => {
    try {
        const { html } = req.body;
        if (!html || html.trim().length < 50) {
            return res.status(400).json({ error: 'No HTML provided or too short.' });
        }
        const data = parseSpyop(html);
        res.json({ success: true, data });
    } catch (err) {
        console.error('Parse error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/save — save spyop to database
app.post('/api/save', (req, res) => {
    try {
        const { html, parsed } = req.body;
        if (!html || !parsed) {
            return res.status(400).json({ error: 'Missing html or parsed data.' });
        }

        // Duplicate detection
        const dup = db.findDuplicate({
            country_number: parsed.country_number,
            turns_taken:    parsed.turns_taken,
            server_id:      parsed.server_id,
            reset_id:       parsed.reset_id,
        });

        const id = db.saveSpyop({ ...parsed, raw_html: html });
        res.json({ success: true, id, duplicate: !!dup, duplicateId: dup?.id });
    } catch (err) {
        console.error('Save error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/spyops — list spyops (with optional filters)
app.get('/api/spyops', (req, res) => {
    try {
        const { government, search, limit = 200, offset = 0 } = req.query;
        const rows = db.getSpyops({
            government: government || null,
            search:     search     || null,
            limit:      parseInt(limit,  10),
            offset:     parseInt(offset, 10),
        });
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/spyops/:id — get single spyop (includes raw_html and JSON blobs)
app.get('/api/spyops/:id', (req, res) => {
    try {
        const row = db.getSpyopById(req.params.id);
        if (!row) {return res.status(404).json({ error: 'Not found.' });}
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/spyops/:id
app.delete('/api/spyops/:id', (req, res) => {
    try {
        db.deleteSpyop(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/governments — distinct government types + counts
app.get('/api/governments', (req, res) => {
    try {
        res.json(db.getGovernments());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stats — global summary numbers
app.get('/api/stats', (req, res) => {
    try {
        res.json(db.getGlobalStats());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/dashboard — time-series + aggregates for charts
app.get('/api/dashboard', (req, res) => {
    try {
        const { governments, dateFrom, dateTo } = req.query;
        // governments may be a comma-separated list
        const govList = governments
            ? governments.split(',').map(g => g.trim()).filter(Boolean)
            : [];
        res.json(db.getDashboardData({ governments: govList, dateFrom, dateTo }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('\n🌍  Earth Stats is running!');
    console.log(`    Open: http://localhost:${PORT}\n`);
});
