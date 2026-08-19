/* ============================================================
   Earth Stats — app.js
   Frontend SPA logic: routing, import, dashboard, records
   ============================================================ */

'use strict';

// ─── Government colour map ────────────────────────────────────────────────────
const GOV_COLORS = {
    'Monarchy':      '#f59e0b',
    'Democracy':     '#3b82f6',
    'Dictatorship':  '#ef4444',
    'Theocracy':     '#8b5cf6',
    'Communist':     '#22c55e',
    'Fascism':       '#f97316',
    'Republic':      '#06b6d4',
    'Tyranny':       '#ec4899',
    'Federation':    '#84cc16',
    'Anarchy':       '#94a3b8',
};

function govColor(gov) {
    if (!gov) {return '#64748b';}
    // exact match first
    if (GOV_COLORS[gov]) {return GOV_COLORS[gov];}
    // partial match
    for (const [k, v] of Object.entries(GOV_COLORS)) {
        if (gov.toLowerCase().includes(k.toLowerCase())) {return v;}
    }
    return '#64748b';
}

function govBadgeStyle(gov) {
    const c = govColor(gov);
    return `background:${c}22;border:1px solid ${c}55;color:${c}`;
}

// ─── Shared state ─────────────────────────────────────────────────────────────
const state = {
    currentView:   'import',
    parsedData:    null,
    rawHtml:       null,
    governments:   [],
    activeGovs:    new Set(),   // dashboard filter
    charts:        { timeline: null, bar: null },
    records:       [],
    sortCol:       'captured_at',
    sortDir:       'desc',
    expandedRowId: null,
};

// ─── Utility ──────────────────────────────────────────────────────────────────

function fmt(n, decimals = 0) {
    if (n === null || n === undefined || n === '') {return '—';}
    const num = parseFloat(n);
    if (isNaN(num)) {return String(n);}
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtMoney(n) {
    if (n === null || n === undefined) {return '—';}
    return '$' + fmt(n);
}

function fmtDate(iso) {
    if (!iso) {return '—';}
    try {
        return new Date(iso).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch { return iso; }
}

function fmtShortDate(iso) {
    if (!iso) {return '—';}
    try {
        return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return iso; }
}

async function apiFetch(path, opts = {}) {
    const r = await fetch(path, opts);
    if (!r.ok) {
        const body = await r.json().catch(() => ({ error: r.statusText }));
        throw new Error(body.error || r.statusText);
    }
    return r.json();
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast ${type}`;
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function navigate(view) {
    state.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    document.getElementById(`nav-${view}`).classList.add('active');

    if (view === 'dashboard') {initDashboard();}
    if (view === 'records')   {initRecords();}
}

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
});

// ─── Global stats (sidebar counter) ──────────────────────────────────────────
async function refreshGlobalStats() {
    try {
        const s = await apiFetch('/api/stats');
        document.getElementById('stat-total').textContent = fmt(s.total);
        document.getElementById('sc-total').textContent   = fmt(s.total);
        document.getElementById('sc-govs').textContent    = fmt(s.gov_count);
        document.getElementById('sc-maxdef').textContent  = s.max_def ? fmt(s.max_def, 0) : '—';
        document.getElementById('sc-latest').textContent  = s.latest ? fmtShortDate(s.latest) : '—';
    } catch { /* silently ignore */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT VIEW
// ═══════════════════════════════════════════════════════════════════════════════

const $htmlInput   = document.getElementById('html-input');
const $previewCol  = document.getElementById('preview-col');
const $previewSecs = document.getElementById('preview-sections');
const $prevCountry = document.getElementById('preview-country');
const $prevGovBadge = document.getElementById('preview-gov-badge');
const $dupWarning  = document.getElementById('dup-warning');
const $btnParse    = document.getElementById('btn-parse');
const $btnSave     = document.getElementById('btn-save');
const $btnDiscard  = document.getElementById('btn-discard');
const $btnClearInput = document.getElementById('btn-clear-input');

$btnParse.addEventListener('click', handleParse);
$btnSave.addEventListener('click', handleSave);
$btnClearInput.addEventListener('click', () => {
    $htmlInput.value = '';
    $previewCol.style.display = 'none';
    state.parsedData = null;
    state.rawHtml = null;
});
$btnDiscard.addEventListener('click', () => {
    $previewCol.style.display = 'none';
    state.parsedData = null;
    state.rawHtml = null;
});

async function handleParse() {
    const html = $htmlInput.value.trim();
    if (!html) { showToast('Please paste spyop HTML first.', 'warn'); return; }

    $btnParse.disabled = true;
    $btnParse.textContent = 'Parsing…';

    try {
        const { data } = await apiFetch('/api/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html }),
        });

        state.parsedData = data;
        state.rawHtml    = html;
        renderPreview(data);
        $previewCol.style.display = 'block';
    } catch (err) {
        showToast('Parse error: ' + err.message, 'error');
    } finally {
        $btnParse.disabled = false;
        $btnParse.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 19 20.1 19 19V15M20 7L12 15M12 15H17M12 15V10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg> Parse HTML';
    }
}

function renderPreview(d) {
    const country = d.country_name
        ? `${d.country_name} (#${d.country_number ?? '?'})`
        : 'Unknown Country';

    $prevCountry.textContent = country;
    $prevGovBadge.textContent = d.government || 'Unknown Gov';
    $prevGovBadge.setAttribute('style', govBadgeStyle(d.government));

    // Build sections
    const basics = [
        ['Turns Taken',   fmt(d.turns_taken)],
        ['Turns Left',    fmt(d.turns_left)],
        ['Turns Stored',  fmt(d.turns_stored)],
        ['Land (Acres)',  fmt(d.acres)],
        ['Rank',          fmt(d.rank)],
        ['Networth',      fmtMoney(d.networth)],
        ['Money',         fmtMoney(d.money)],
        ['Population',    fmt(d.population)],
        ['At War',        d.at_war ? 'Yes' : 'No'],
        ['GDI Member',    d.gdi_member ? 'Yes' : 'No'],
        ['Last Turn',     d.last_turn_time || '—'],
        ['Server / Reset',d.server_id ? `${d.server_id} / ${d.reset_id}` : '—'],
    ];

    // SS Def highlight
    const ssVal = d.calc_ss_def_turrets;
    const ssLabel = d.calc_ss_def_label || 'Calc SS Def In Turrets';

    // Land distribution
    let landRows = [], techRows = [], milRows = [];
    // eslint-disable-next-line no-empty
    try { landRows = Object.entries(JSON.parse(d.land_dist_json || '{}')); } catch {}
    // eslint-disable-next-line no-empty
    try { techRows = Object.entries(JSON.parse(d.technology_json || '{}')).filter(([k]) => !k.endsWith('_pct') && !k.endsWith('_pts')); } catch {}
    try {
        const mil = JSON.parse(d.military_json || '{}');
        milRows = Object.entries(mil._merged || {});
    // eslint-disable-next-line no-empty
    } catch {}

    let html = '';

    // Defence highlight card
    html += `<div class="preview-section">
    <div class="preview-section-title">🛡️ Key Defense Metric</div>
    <div class="preview-row">
      <span class="preview-key">${ssLabel}</span>
      <span class="preview-val ${ssVal !== null ? 'highlight' : 'null-val'}">${ssVal !== null ? fmt(ssVal, 0) : '— not found'}</span>
    </div>
  </div>`;

    html += buildPreviewSection('The Basics', basics, true);

    if (landRows.length) {html += buildPreviewSection('Land Distribution', landRows, true);}
    if (techRows.length) {html += buildPreviewSection('Technology', techRows, true);}
    if (milRows.length)  {html += buildPreviewSection('Military', milRows, true);}

    $previewSecs.innerHTML = html;
    $dupWarning.style.display = 'none';
}

function buildPreviewSection(title, rows, useGrid = false) {
    const items = rows.map(([k, v]) => {
        const val = (v === null || v === '' || v === undefined) ? '—' : v;
        const cls = (val === '—') ? 'null-val' : '';
        return `<div class="preview-row">
      <span class="preview-key">${k}</span>
      <span class="preview-val ${cls}">${val}</span>
    </div>`;
    }).join('');

    return `<div class="preview-section">
    <div class="preview-section-title">${title}</div>
    <div class="${useGrid ? 'preview-grid' : ''}">${items}</div>
  </div>`;
}

async function handleSave() {
    if (!state.parsedData || !state.rawHtml) {return;}
    $btnSave.disabled = true;
    $btnSave.textContent = 'Saving…';

    try {
        const res = await apiFetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html: state.rawHtml, parsed: state.parsedData }),
        });

        if (res.duplicate) {
            $dupWarning.style.display = 'block';
            showToast('Saved (possible duplicate detected)', 'warn');
        } else {
            showToast('Spyop saved successfully! ID #' + res.id, 'success');
        }

        // Reset
        $htmlInput.value = '';
        $previewCol.style.display = 'none';
        state.parsedData = null;
        state.rawHtml    = null;
        refreshGlobalStats();
    } catch (err) {
        showToast('Save error: ' + err.message, 'error');
    } finally {
        $btnSave.disabled = false;
        $btnSave.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M19 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H16L21 8V19C21 20.1 20.1 21 19 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M17 21V13H7V21M7 3V8H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg> Save to Database';
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════════════════════════════════════════════

let dashboardInitialized = false;

async function initDashboard() {
    if (!dashboardInitialized) {
        dashboardInitialized = true;
        await loadGovernments();
        renderGovPills();
        setupDashboardEvents();
    }
    await loadDashboardData();
}

async function loadGovernments() {
    try {
        state.governments = await apiFetch('/api/governments');
        // Start with all governments active
        state.activeGovs = new Set(state.governments.map(g => g.government));
    // eslint-disable-next-line no-empty
    } catch {}
}

function renderGovPills() {
    const container = document.getElementById('gov-pills');
    container.innerHTML = state.governments.map(g => {
        const color = govColor(g.government);
        return `<button class="gov-pill active" data-gov="${g.government}"
      style="background:${color}22;border-color:${color}55;color:${color}"
      title="${g.count} records">
      ${g.government}
    </button>`;
    }).join('');

    container.querySelectorAll('.gov-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const gov = pill.dataset.gov;
            if (state.activeGovs.has(gov)) {
                state.activeGovs.delete(gov);
                pill.classList.remove('active');
                pill.style.opacity = '0.4';
            } else {
                state.activeGovs.add(gov);
                pill.classList.add('active');
                pill.style.opacity = '1';
            }
        });
    });
}

function setupDashboardEvents() {
    document.getElementById('btn-apply-filter').addEventListener('click', loadDashboardData);
    document.getElementById('btn-reset-filter').addEventListener('click', () => {
        document.getElementById('filter-from').value = '';
        document.getElementById('filter-to').value   = '';
        state.activeGovs = new Set(state.governments.map(g => g.government));
        document.querySelectorAll('.gov-pill').forEach(p => {
            p.classList.add('active');
            p.style.opacity = '1';
        });
        loadDashboardData();
    });
}

async function loadDashboardData() {
    try {
        const params = new URLSearchParams();
        if (state.activeGovs.size > 0 && state.activeGovs.size < state.governments.length) {
            params.set('governments', [...state.activeGovs].join(','));
        }
        const from = document.getElementById('filter-from').value;
        const to   = document.getElementById('filter-to').value;
        if (from) {params.set('dateFrom', from);}
        if (to)   {params.set('dateTo',   to);}

        const data = await apiFetch('/api/dashboard?' + params.toString());
        renderCharts(data);
        renderGovTable(data.aggregates);
        refreshGlobalStats();
    } catch (err) {
        showToast('Dashboard error: ' + err.message, 'error');
    }
}

// ── Charts ────────────────────────────────────────────────────────────────────

const CHART_DEFAULTS = {
    color: '#e2e8f0',
    borderColor: 'rgba(255,255,255,0.08)',
    gridColor: 'rgba(255,255,255,0.06)',
    tickColor: '#64748b',
};

function buildChartDefaults() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: CHART_DEFAULTS.tickColor,
                    font: { family: 'Inter', size: 11 },
                    boxWidth: 12,
                    padding: 16,
                },
            },
        },
        scales: {
            x: {
                grid:   { color: CHART_DEFAULTS.gridColor },
                ticks:  { color: CHART_DEFAULTS.tickColor, font: { family: 'Inter', size: 11 } },
                border: { color: CHART_DEFAULTS.borderColor },
            },
            y: {
                grid:   { color: CHART_DEFAULTS.gridColor },
                ticks:  { color: CHART_DEFAULTS.tickColor, font: { family: 'Inter', size: 11 } },
                border: { color: CHART_DEFAULTS.borderColor },
            },
        },
    };
}

function renderCharts({ timeSeries, aggregates }) {
    renderTimelineChart(timeSeries);
    renderBarChart(aggregates);
}

function renderTimelineChart(timeSeries) {
    const ctx = document.getElementById('chart-timeline').getContext('2d');

    // Group by government
    const byGov = {};
    for (const pt of timeSeries) {
        const gov = pt.government || 'Unknown';
        if (!byGov[gov]) {byGov[gov] = [];}
        byGov[gov].push({
            x: new Date(pt.captured_at),
            y: pt.calc_ss_def_turrets,
            label: `${pt.country_name ?? ''} (#${pt.country_number ?? '?'})`,
            acres: pt.acres,
            turns: pt.turns_taken,
            networth: pt.networth,
            id: pt.id,
        });
    }

    const datasets = Object.entries(byGov).map(([gov, pts]) => {
        const color = govColor(gov);
        return {
            label: gov,
            data: pts,
            borderColor: color,
            backgroundColor: color + '33',
            pointBackgroundColor: color,
            pointBorderColor: color + 'aa',
            pointRadius: 5,
            pointHoverRadius: 8,
            showLine: true,
            tension: 0.3,
            fill: false,
        };
    });

    if (state.charts.timeline) {state.charts.timeline.destroy();}

    state.charts.timeline = new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        options: {
            ...buildChartDefaults(),
            plugins: {
                ...buildChartDefaults().plugins,
                tooltip: {
                    callbacks: {
                        title: items => {
                            const d = items[0];
                            const pt = datasets[d.datasetIndex].data[d.dataIndex];
                            return [pt.label, fmtDate(new Date(d.parsed.x).toISOString())];
                        },
                        label: items => {
                            const pt = datasets[items.datasetIndex].data[items.dataIndex];
                            return [
                                `SS Def: ${fmt(items.parsed.y, 0)}`,
                                `Acres: ${fmt(pt.acres)}`,
                                `Turns: ${fmt(pt.turns)}`,
                                `Networth: ${fmtMoney(pt.networth)}`,
                            ];
                        },
                    },
                    titleFont: { family: 'Inter', size: 12 },
                    bodyFont:  { family: 'Inter', size: 12 },
                    backgroundColor: 'rgba(7,9,26,0.92)',
                    borderColor: 'rgba(255,255,255,0.12)',
                    borderWidth: 1,
                    padding: 12,
                },
            },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'day', tooltipFormat: 'dd MMM yyyy HH:mm' },
                    grid:   { color: CHART_DEFAULTS.gridColor },
                    ticks:  { color: CHART_DEFAULTS.tickColor, font: { family: 'Inter', size: 11 } },
                    border: { color: CHART_DEFAULTS.borderColor },
                },
                y: {
                    title: { display: true, text: 'Calc SS Def In Turrets', color: CHART_DEFAULTS.tickColor, font: { size: 11 } },
                    grid:   { color: CHART_DEFAULTS.gridColor },
                    ticks:  { color: CHART_DEFAULTS.tickColor, font: { family: 'Inter', size: 11 } },
                    border: { color: CHART_DEFAULTS.borderColor },
                },
            },
        },
    });
}

function renderBarChart(aggregates) {
    const ctx = document.getElementById('chart-bar').getContext('2d');

    const labels   = aggregates.map(a => a.government || 'Unknown');
    const avgs     = aggregates.map(a => a.avg_def);
    const maxVals  = aggregates.map(a => a.max_def);
    const colors   = labels.map(g => govColor(g));

    if (state.charts.bar) {state.charts.bar.destroy();}

    state.charts.bar = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Average SS Def',
                    data: avgs,
                    backgroundColor: colors.map(c => c + '88'),
                    borderColor: colors,
                    borderWidth: 2,
                    borderRadius: 6,
                },
                {
                    label: 'Max SS Def',
                    data: maxVals,
                    backgroundColor: colors.map(c => c + '33'),
                    borderColor: colors.map(c => c + '66'),
                    borderWidth: 1,
                    borderRadius: 6,
                    type: 'bar',
                },
            ],
        },
        options: {
            ...buildChartDefaults(),
            plugins: {
                ...buildChartDefaults().plugins,
                tooltip: {
                    titleFont: { family: 'Inter', size: 12 },
                    bodyFont:  { family: 'Inter', size: 12 },
                    backgroundColor: 'rgba(7,9,26,0.92)',
                    borderColor: 'rgba(255,255,255,0.12)',
                    borderWidth: 1,
                    padding: 12,
                },
            },
            scales: {
                x: {
                    grid:   { color: CHART_DEFAULTS.gridColor },
                    ticks:  { color: CHART_DEFAULTS.tickColor, font: { family: 'Inter', size: 11 } },
                    border: { color: CHART_DEFAULTS.borderColor },
                },
                y: {
                    title: { display: true, text: 'SS Def In Turrets', color: CHART_DEFAULTS.tickColor, font: { size: 11 } },
                    grid:   { color: CHART_DEFAULTS.gridColor },
                    ticks:  { color: CHART_DEFAULTS.tickColor, font: { family: 'Inter', size: 11 } },
                    border: { color: CHART_DEFAULTS.borderColor },
                },
            },
        },
    });
}

// ── Gov breakdown table ────────────────────────────────────────────────────────
function renderGovTable(aggregates) {
    const tbody = document.getElementById('gov-table-body');
    if (!aggregates.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">No data — import spyops first.</td></tr>';
        return;
    }
    tbody.innerHTML = aggregates.map(a => {
        const _color = govColor(a.government); // eslint-disable-line no-unused-vars
        return `<tr>
      <td>
        <span class="gov-badge" style="${govBadgeStyle(a.government)}">${a.government ?? '—'}</span>
      </td>
      <td class="num">${fmt(a.count)}</td>
      <td class="num text-gold">${fmt(a.avg_def, 0)}</td>
      <td class="num">${fmt(a.min_def, 0)}</td>
      <td class="num">${fmt(a.max_def, 0)}</td>
      <td class="num">${fmt(a.avg_acres, 0)}</td>
    </tr>`;
    }).join('');
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECORDS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

async function initRecords() {
    await loadRecordsGovFilter();
    await loadRecords();
    setupRecordsEvents();
}

async function loadRecordsGovFilter() {
    const sel = document.getElementById('rec-gov-filter');
    if (sel.options.length > 1) {return;} // already loaded
    try {
        const govs = await apiFetch('/api/governments');
        govs.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.government;
            opt.textContent = `${g.government} (${g.count})`;
            sel.appendChild(opt);
        });
    // eslint-disable-next-line no-empty
    } catch {}
}

function setupRecordsEvents() {
    if (document._recEventsAttached) {return;}
    document._recEventsAttached = true;

    document.getElementById('rec-search').addEventListener('input', debounce(loadRecords, 300));
    document.getElementById('rec-gov-filter').addEventListener('change', loadRecords);
    document.getElementById('btn-rec-clear').addEventListener('click', () => {
        document.getElementById('rec-search').value = '';
        document.getElementById('rec-gov-filter').value = '';
        loadRecords();
    });

    // Sortable columns
    document.querySelectorAll('#records-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (state.sortCol === col) {
                state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                state.sortCol = col;
                state.sortDir = 'desc';
            }
            renderRecordsTable();
            updateSortHeaders();
        });
    });
}

function updateSortHeaders() {
    document.querySelectorAll('#records-table th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === state.sortCol) {
            th.classList.add(state.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });
}

async function loadRecords() {
    const search = document.getElementById('rec-search').value.trim();
    const gov    = document.getElementById('rec-gov-filter').value;
    const params = new URLSearchParams({ limit: 500 });
    if (search) {params.set('search', search);}
    if (gov)    {params.set('government', gov);}

    try {
        state.records = await apiFetch('/api/spyops?' + params.toString());
        state.expandedRowId = null;
        renderRecordsTable();
        updateSortHeaders();
    } catch (err) {
        showToast('Load error: ' + err.message, 'error');
    }
}

function sortedRecords() {
    const col = state.sortCol;
    const dir = state.sortDir === 'asc' ? 1 : -1;
    return [...state.records].sort((a, b) => {
        const va = a[col], vb = b[col];
        if (va === null || va === undefined) {return 1;}
        if (vb === null || vb === undefined) {return -1;}
        if (typeof va === 'string') {return va.localeCompare(vb) * dir;}
        return (va - vb) * dir;
    });
}

function renderRecordsTable() {
    const tbody = document.getElementById('records-body');
    const empty = document.getElementById('rec-empty');
    const badge = document.getElementById('rec-count');
    const rows  = sortedRecords();

    badge.textContent = `${rows.length} record${rows.length !== 1 ? 's' : ''}`;

    if (!rows.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    tbody.innerHTML = rows.map(r => {
        const isExp = state.expandedRowId === r.id;
        const ssVal = r.calc_ss_def_turrets !== null ? fmt(r.calc_ss_def_turrets, 0) : '—';
        const rowHtml = `
      <tr class="${isExp ? 'expanded' : ''}" data-id="${r.id}">
        <td class="muted">${fmtShortDate(r.captured_at)}</td>
        <td><strong>${r.country_name ?? '—'}</strong> <span class="muted">#${r.country_number ?? '?'}</span></td>
        <td><span class="gov-badge" style="${govBadgeStyle(r.government)}">${r.government ?? '—'}</span></td>
        <td class="num">${fmt(r.acres)}</td>
        <td class="num">${fmt(r.turns_taken)}</td>
        <td class="num">${fmtMoney(r.networth)}</td>
        <td class="num text-gold"><strong>${ssVal}</strong></td>
        <td>
          <button class="btn btn-danger btn-sm del-btn" data-id="${r.id}" title="Delete">🗑</button>
        </td>
      </tr>`;

        const expandHtml = isExp ? `<tr class="expand-row" data-expand-for="${r.id}"><td colspan="8"><div id="expand-${r.id}" class="expand-inner"></div></td></tr>` : '';
        return rowHtml + expandHtml;
    }).join('');

    // Row click → expand
    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
        tr.addEventListener('click', e => {
            if (e.target.closest('.del-btn')) {return;}
            const id = parseInt(tr.dataset.id, 10);
            if (state.expandedRowId === id) {
                state.expandedRowId = null;
            } else {
                state.expandedRowId = id;
            }
            renderRecordsTable();
            if (state.expandedRowId === id) {loadExpandDetail(id);}
        });
    });

    // Delete buttons
    tbody.querySelectorAll('.del-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (!confirm(`Delete spyop #${id}? This cannot be undone.`)) {return;}
            try {
                await apiFetch('/api/spyops/' + id, { method: 'DELETE' });
                showToast('Spyop deleted.', 'success');
                state.records = state.records.filter(r => r.id !== parseInt(id, 10));
                if (state.expandedRowId === parseInt(id, 10)) {state.expandedRowId = null;}
                renderRecordsTable();
                refreshGlobalStats();
            } catch (err) {
                showToast('Delete error: ' + err.message, 'error');
            }
        });
    });
}

async function loadExpandDetail(id) {
    const container = document.getElementById(`expand-${id}`);
    if (!container) {return;}
    container.innerHTML = '<p style="color:var(--text-muted);font-size:12px">Loading…</p>';

    try {
        const d = await apiFetch('/api/spyops/' + id);

        let basics = {}, land = {}, tech = {}, mil = {};
        // eslint-disable-next-line no-empty
        try { basics = JSON.parse(d.basics_json || '{}'); } catch {}
        // eslint-disable-next-line no-empty
        try { land   = JSON.parse(d.land_dist_json || '{}'); } catch {}
        // eslint-disable-next-line no-empty
        try { tech   = JSON.parse(d.technology_json || '{}'); } catch {}
        // eslint-disable-next-line no-empty
        try { mil    = JSON.parse(d.military_json || '{}')._merged || {}; } catch {}

        const sections = [
            { title: '📋 The Basics',          rows: basics },
            { title: '🏗️ Land Distribution',   rows: land   },
            { title: '🔬 Technology',           rows: tech   },
            { title: '⚔️ Military',             rows: mil    },
        ].filter(s => Object.keys(s.rows).length > 0);

        container.innerHTML = sections.map(s => `
      <div>
        <div class="expand-section-title">${s.title}</div>
        <div class="expand-kv">
          ${Object.entries(s.rows).map(([k, v]) => `
            <div class="expand-row-kv">
              <span class="k">${k}</span>
              <span class="v">${v ?? '—'}</span>
            </div>`).join('')}
        </div>
      </div>
    `).join('');

        // Fallback if no sections parsed
        if (!sections.length) {
            container.innerHTML = `<p style="color:var(--text-muted);font-size:12px;padding:16px">
        No structured data available for this record.</p>`;
        }

    } catch (err) {
        container.innerHTML = `<p style="color:var(--danger);font-size:12px">Error loading detail: ${err.message}</p>`;
    }
}

// ─── Drawer (kept for future use but inline expand is primary) ────────────────
document.getElementById('drawer-close').addEventListener('click', closeDrawer);
document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);

function closeDrawer() {
    document.getElementById('detail-drawer').style.display = 'none';
    document.getElementById('drawer-overlay').style.display = 'none';
}

// ─── Debounce helper ──────────────────────────────────────────────────────────
function debounce(fn, delay) {
    let t;
    return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
refreshGlobalStats();
