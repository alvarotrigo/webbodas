/**
 * RSVP Dashboard Logic
 * Handles submissions table, inline editing, form toggle,
 * access link sharing, CSV export, and search/pagination.
 */

(function () {
    'use strict';

    // ----------------------------------------------------------------
    // State
    // ----------------------------------------------------------------
    var state = {
        pageId: null,
        pageTitle: '',
        pageUrl: '',      // public website URL for link in header
        submissions: [],
        filtered: [],
        total: 0,
        formOpen: true,
        formClosedMessage: '',
        search: '',
        page: 1,
        perPage: 50,
        loading: false,
        accessToken: null,
        groups: [],        // [{id, name, color}, …]
        groupFilter: new Set(), // empty = all; Set of group ids (0 = "no group")
        pageSlug: '',     // share_slug for linking to public form (website#rsvp)
        sortCol: null,
        sortDir: 'asc',
        columnFilters: {},  // { colKey: Set of selected values }
        openFilterCol: null,
        colWidths: {},      // { colKey: widthPx } — persists column resize across re-renders
    };

    // Wedding-friendly color palette for group swatches
    var GROUP_COLORS = [
        '#9333ea', '#ec4899', '#f97316', '#eab308',
        '#22c55e', '#06b6d4', '#3b82f6', '#ef4444',
        '#8b5cf6', '#14b8a6',
    ];
    var selectedGroupColor = GROUP_COLORS[0];

    // ----------------------------------------------------------------
    // Init
    // ----------------------------------------------------------------
    function init() {
        var params = new URLSearchParams(window.location.search);
        state.pageId     = params.get('page') || '';
        state.accessToken = params.get('access_token') || null;

        if (!state.pageId) {
            showGlobalError('Missing page parameter in URL.');
            return;
        }

        setupUserMenu();
        setupDarkMode();
        loadSubmissions();
        bindTopBarActions();
        renderColorSwatches();
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }

    // ----------------------------------------------------------------
    // API helpers
    // ----------------------------------------------------------------
    function apiUrl(params) {
        var base = 'api/submissions.php?';
        var parts = [];
        for (var k in params) {
            if (params[k] !== undefined && params[k] !== null) {
                parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
            }
        }
        return base + parts.join('&');
    }

    function apiFetch(url, options) {
        options = options || {};
        options.credentials = 'same-origin';
        return fetch(url, options).then(function (res) {
            if (res.headers.get('content-type') && res.headers.get('content-type').indexOf('application/json') !== -1) {
                return res.json().then(function (data) {
                    if (!res.ok) throw new Error(data.error || 'Server error');
                    return data;
                });
            }
            return res;
        });
    }

    // ----------------------------------------------------------------
    // Load submissions
    // ----------------------------------------------------------------
    function loadSubmissions() {
        if (state.loading) return;
        state.loading = true;
        showLoading(true);

        var params = {
            page_id: state.pageId,
            limit: 500,   // Load all; paginate client-side
        };
        if (state.accessToken) params.access_token = state.accessToken;

        apiFetch(apiUrl(params))
            .then(function (data) {
                state.submissions    = data.submissions || [];
                state.total          = data.total || 0;
                state.formOpen       = data.form_open !== false;
                state.formClosedMessage = data.form_closed_message || '';
                state.pageTitle      = data.page_title || '';
                state.pageUrl        = (data.page_url && String(data.page_url).trim()) || '';
                state.groups         = data.groups || [];
                state.pageSlug       = (data.share_slug && String(data.share_slug).trim()) || '';

                updatePageTitle();
                updateFormStatusBadge();
                renderGroupFilter();
                applyFilter();
            })
            .catch(function (err) {
                showGlobalError(err.message || 'Could not load submissions.');
            })
            .finally(function () {
                state.loading = false;
                showLoading(false);
            });
    }

    // ----------------------------------------------------------------
    // Filter + render
    // ----------------------------------------------------------------
    function applyFilter() {
        var q = state.search.toLowerCase().trim();
        state.filtered = state.submissions.filter(function (s) {
            // Group filter (category pills — multi-select)
            if (state.groupFilter.size > 0) {
                var hasGroupId = s.group_id !== null && s.group_id !== undefined;
                if (!hasGroupId) {
                    // Submission has no group: only pass if "No group" (0) is selected
                    if (!state.groupFilter.has(0)) return false;
                } else {
                    if (!state.groupFilter.has(Number(s.group_id))) return false;
                }
            }
            // Column filters (checkbox dropdowns)
            var fd = s.form_data || {};
            for (var colKey in state.columnFilters) {
                var vals = state.columnFilters[colKey];
                if (!vals || !vals.size) continue;
                var cellVal = '';
                if (colKey === 'group') {
                    var grp = s.group_id ? state.groups.find(function (g) { return g.id === s.group_id; }) : null;
                    cellVal = grp ? grp.name : '';
                } else if (colKey === 'table') {
                    cellVal = s.table_number || '';
                } else {
                    cellVal = String(fd[colKey] || '');
                }
                if (!vals.has(cellVal)) return false;
            }
            // Text search
            if (!q) return true;
            var haystack = Object.values(fd).join(' ').toLowerCase()
                + ' ' + (s.notes || '').toLowerCase()
                + ' ' + (s.table_number || '').toLowerCase();
            return haystack.indexOf(q) !== -1;
        });

        // Sort
        if (state.sortCol) {
            var sc = state.sortCol;
            var sd = state.sortDir;
            state.filtered.sort(function (a, b) {
                var va = getSortValue(a, sc).toLowerCase();
                var vb = getSortValue(b, sc).toLowerCase();
                if (va < vb) return sd === 'asc' ? -1 : 1;
                if (va > vb) return sd === 'asc' ? 1 : -1;
                return 0;
            });
        }

        state.page = 1;
        renderTable();
        renderStats();
    }

    function getSortValue(sub, colKey) {
        if (colKey === 'group') {
            var grp = sub.group_id ? state.groups.find(function (g) { return g.id === sub.group_id; }) : null;
            return grp ? grp.name : '';
        }
        if (colKey === 'table') return sub.table_number || '';
        return String((sub.form_data || {})[colKey] || '');
    }

    function renderTable() {
        var cols = getFormColumns();
        var allCols = getAllColumns(cols);

        if (!state.filtered.length) {
            var tableWrap = document.getElementById('rsvp-table-wrap');
            if (tableWrap) {
                tableWrap.innerHTML = buildEmptyState();
            }
            return;
        }

        restoreTableStructure();
        renderTableHead(allCols);

        var tbody = document.getElementById('rsvp-table-body');
        if (!tbody) return;

        var start = (state.page - 1) * state.perPage;
        var pageItems = state.filtered.slice(start, start + state.perPage);

        var html = '';
        pageItems.forEach(function (sub) {
            html += buildRow(sub, cols);
        });
        tbody.innerHTML = html;

        // Pagination
        var totalPages = Math.ceil(state.filtered.length / state.perPage);
        var tableWrap = document.getElementById('rsvp-table-wrap');
        if (tableWrap) {
            var existingPag = tableWrap.querySelector('.rsvp-pagination');
            if (existingPag) existingPag.remove();
            if (totalPages > 1) {
                tableWrap.insertAdjacentHTML('beforeend', buildPagination(totalPages));
            }
        }

        // Bind inline edit events
        if (tableWrap) {
            tableWrap.querySelectorAll('[data-editable]').forEach(bindInlineEdit);
            tableWrap.querySelectorAll('[data-fixed-option]').forEach(bindFixedOptionEdit);
            tableWrap.querySelectorAll('[data-notes-id]').forEach(bindNotesEdit);
            tableWrap.querySelectorAll('[data-group-badge]').forEach(bindGroupBadge);
            tableWrap.querySelectorAll('[data-delete-id]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    handleDelete(parseInt(btn.getAttribute('data-delete-id')));
                });
            });
            tableWrap.querySelectorAll('.rsvp-pagination-btn[data-page]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    state.page = parseInt(btn.getAttribute('data-page'));
                    renderTable();
                });
            });
        }
    }

    function getAllColumns(cols) {
        var allCols = cols.map(function (key) {
            var def = FORM_COLUMNS.find(function (c) { return c.key === key; });
            return def || { key: key, label: formatColLabel(key), filterable: false };
        });
        EXTRA_COLUMNS.forEach(function (ec) {
            allCols.push(ec);
        });
        allCols.push({ key: 'notes', label: 'Notes', filterable: false });
        allCols.push({ key: 'date', label: 'Submitted', filterable: false });
        allCols.push({ key: 'actions', label: '', filterable: false });
        return allCols;
    }

    // Default column widths (px) used when no saved width exists
    var DEFAULT_COL_WIDTHS = {
        attendance: 52,
        fullName:   160,
        email:      180,
        phone:      140,
        dietary:    130,
        message:    200,
        group:      130,
        table:       90,
        actions:     70,
    };

    function getColWidth(key) {
        return (state.colWidths && state.colWidths[key]) || DEFAULT_COL_WIDTHS[key] || 120;
    }

    // Sync <colgroup> widths whenever a new column set is rendered
    function syncColgroup(allCols) {
        var table = document.querySelector('table.rsvp-table');
        if (!table) return;
        var colgroup = table.querySelector('colgroup');
        if (!colgroup) {
            colgroup = document.createElement('colgroup');
            table.insertBefore(colgroup, table.firstChild);
        }
        colgroup.innerHTML = allCols.map(function (col) {
            return '<col data-col-key="' + escAttr(col.key) + '" style="width:' + getColWidth(col.key) + 'px">';
        }).join('');
    }

    function renderTableHead(allCols) {
        var thead = document.getElementById('rsvp-table-head');
        if (!thead) return;

        // Build colgroup so table-layout:fixed respects our widths
        syncColgroup(allCols);

        var html = '<tr>';
        allCols.forEach(function (col) {
            var sorted = state.sortCol === col.key ? ' sorted' : '';
            html += '<th class="col-' + escAttr(col.key) + sorted + '" data-sort-col="' + escAttr(col.key) + '">';
            html += '<div class="rsvp-th-content">';
            html += escHtml(col.label);
            if (col.key !== 'actions') {
                html += '<span class="rsvp-sort-icon">' + getSortIcon(col.key) + '</span>';
            }
            if (col.filterable) {
                var hasFilter = state.columnFilters[col.key] && state.columnFilters[col.key].size > 0;
                html += '<span class="rsvp-th-filter-icon' + (hasFilter ? ' active' : '') + '" data-filter-col="' + escAttr(col.key) + '">';
                html += '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
                html += '</span>';
            }
            html += '</div>';
            // Resize handle (outside .rsvp-th-content so it isn't clipped by flex)
            if (col.key !== 'actions') {
                html += '<span class="rsvp-col-resizer" data-resize-col="' + escAttr(col.key) + '"></span>';
            }
            html += '</th>';
        });
        html += '</tr>';
        thead.innerHTML = html;

        // Bind sort clicks
        thead.querySelectorAll('[data-sort-col]').forEach(function (th) {
            th.addEventListener('click', function (e) {
                if (e.target.closest('.rsvp-th-filter-icon')) return;
                if (e.target.closest('.rsvp-col-resizer')) return;
                var key = th.getAttribute('data-sort-col');
                if (key === 'actions') return;
                handleSort(key);
            });
        });

        // Bind filter icon clicks
        thead.querySelectorAll('[data-filter-col]').forEach(function (icon) {
            icon.addEventListener('click', function (e) {
                e.stopPropagation();
                toggleColumnFilter(icon.getAttribute('data-filter-col'), icon);
            });
        });

        // Bind column resize handles
        thead.querySelectorAll('.rsvp-col-resizer').forEach(function (handle) {
            handle.addEventListener('mousedown', function (e) {
                e.stopPropagation();
                e.preventDefault();
                startColResize(e, handle);
            });
        });
    }

    // ----------------------------------------------------------------
    // Column resizing — drives width via <colgroup><col> elements
    // so table-layout:fixed actually applies the change.
    // ----------------------------------------------------------------
    function startColResize(e, handle) {
        var colKey = handle.getAttribute('data-resize-col');
        var table  = document.querySelector('table.rsvp-table');
        if (!table) return;

        var col = table.querySelector('col[data-col-key="' + colKey + '"]');
        if (!col) return;

        var startX     = e.clientX;
        var startWidth = parseInt(col.style.width, 10) || getColWidth(colKey);

        handle.classList.add('resizing');
        document.body.classList.add('rsvp-resizing-col');

        function onMouseMove(ev) {
            var newWidth = Math.max(50, startWidth + (ev.clientX - startX));
            col.style.width = newWidth + 'px';
        }

        function onMouseUp(ev) {
            handle.classList.remove('resizing');
            document.body.classList.remove('rsvp-resizing-col');

            // Persist so re-renders keep the width
            if (!state.colWidths) state.colWidths = {};
            state.colWidths[colKey] = Math.max(50, startWidth + (ev.clientX - startX));

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    function getSortIcon(key) {
        if (state.sortCol !== key) return '\u21C5';
        return state.sortDir === 'asc' ? '\u2191' : '\u2193';
    }

    function handleSort(key) {
        if (state.sortCol === key) {
            state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            state.sortCol = key;
            state.sortDir = 'asc';
        }
        applyFilter();
    }

    // ---- Column filter dropdown ----
    function toggleColumnFilter(colKey, iconEl) {
        if (state.openFilterCol === colKey) {
            closeAllFilterDropdowns();
            return;
        }
        closeAllFilterDropdowns();
        state.openFilterCol = colKey;

        var uniqueVals = getUniqueColValues(colKey);
        var selected = state.columnFilters[colKey] || new Set();

        var dropdown = document.createElement('div');
        dropdown.className = 'rsvp-col-filter-dropdown';
        dropdown.innerHTML = uniqueVals.map(function (v) {
            var checked = selected.has(v) ? ' checked' : '';
            return '<label><input type="checkbox" value="' + escAttr(v) + '"' + checked + '> ' + escHtml(v || '(empty)') + '</label>';
        }).join('');

        iconEl.style.position = 'relative';
        iconEl.appendChild(dropdown);

        dropdown.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                onColFilterChange(colKey, cb.value, cb.checked);
            });
        });
    }

    function getUniqueColValues(colKey) {
        var vals = new Set();
        state.submissions.forEach(function (s) {
            var v = '';
            if (colKey === 'group') {
                var grp = s.group_id ? state.groups.find(function (g) { return g.id === s.group_id; }) : null;
                v = grp ? grp.name : '';
            } else if (colKey === 'table') {
                v = s.table_number || '';
            } else {
                v = String((s.form_data || {})[colKey] || '');
            }
            if (v) vals.add(v);
        });
        return Array.from(vals).sort();
    }

    function onColFilterChange(colKey, value, checked) {
        if (!state.columnFilters[colKey]) state.columnFilters[colKey] = new Set();
        if (checked) {
            state.columnFilters[colKey].add(value);
        } else {
            state.columnFilters[colKey].delete(value);
            if (state.columnFilters[colKey].size === 0) delete state.columnFilters[colKey];
        }
        applyFilter();
    }

    function closeAllFilterDropdowns() {
        state.openFilterCol = null;
        document.querySelectorAll('.rsvp-col-filter-dropdown').forEach(function (d) { d.remove(); });
    }

    function buildRow(sub, cols) {
        var fd = sub.form_data || {};
        var html = '<tr data-id="' + sub.id + '">';

        cols.forEach(function (col) {
            var val = fd[col] !== undefined ? fd[col] : '';
            var fieldKey = resolveFixedOptionFieldKey(col);

            if (fieldKey === 'attendance') {
                // Badge cell — no ellipsis
                html += '<td class="col-attendance-cell">' + buildAttendanceIcon(val, sub.id) + '</td>';
            } else if (col === 'fullName') {
                // Plain text — show ellipsis when column is narrow
                html += '<td class="rsvp-cell-text"><span class="rsvp-cell-editable rsvp-cell-fullname" data-editable data-sub-id="' + sub.id + '" data-field="' + escAttr(col) + '">' + escHtml(String(val)) + '</span></td>';
            } else if (getFixedOptionSpec(fieldKey)) {
                // Badge cell — no ellipsis
                html += '<td>' + buildFixedOptionBadge(fieldKey, val, sub.id) + '</td>';
            } else {
                // Plain text — show ellipsis when column is narrow
                html += '<td class="rsvp-cell-text"><span class="rsvp-cell-editable" data-editable data-sub-id="' + sub.id + '" data-field="' + escAttr(col) + '">' + escHtml(String(val)) + '</span></td>';
            }
        });

        // Group selector — badge cell, no ellipsis
        html += '<td class="col-group-cell">' + buildGroupSelect(sub) + '</td>';

        // Table number — badge cell, no ellipsis
        var tnum = sub.table_number || '';
        html += '<td><span class="rsvp-cell-editable rsvp-table-number-cell" data-editable data-sub-id="' + sub.id + '" data-field="__table_number">' + (tnum ? '<span class="rsvp-badge rsvp-badge-gray">' + escHtml(tnum) + '</span>' : '') + '</span></td>';

        // Notes
        var notes = sub.notes || '';
        html += '<td>';
        html += '<span class="rsvp-cell-editable rsvp-notes-cell" data-notes-id="' + sub.id + '">';
        html += notes ? escHtml(notes) : '<span class="rsvp-notes-placeholder">Add note...</span>';
        html += '</span></td>';

        // Date
        html += '<td class="rsvp-date">' + formatDate(sub.submitted_at) + '</td>';

        // Actions
        html += '<td><button class="rsvp-row-delete-btn" data-delete-id="' + sub.id + '" title="Delete submission">';
        html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
        html += '</button></td>';

        html += '</tr>';
        return html;
    }

    function buildAttendanceIcon(value, subId) {
        var spec = getFixedOptionSpec('attendance');
        var norm = spec.normalizeValue(value);
        if (norm === 'yes') {
            return '<span class="rsvp-attendance-icon rsvp-attendance-yes" data-fixed-option data-sub-id="' + subId + '" data-field="attendance" data-value="yes" title="Click to change">' +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>';
        }
        if (norm === 'no') {
            return '<span class="rsvp-attendance-icon rsvp-attendance-no" data-fixed-option data-sub-id="' + subId + '" data-field="attendance" data-value="no" title="Click to change">' +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>';
        }
        return '<span class="rsvp-attendance-icon rsvp-attendance-unknown" data-fixed-option data-sub-id="' + subId + '" data-field="attendance" data-value="' + escAttr(value) + '" title="Click to change">\u2014</span>';
    }

    function buildEmptyState() {
        return '<div class="rsvp-empty">' +
            '<div class="rsvp-empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="11" y2="16"/></svg></div>' +
            '<h3>' + (state.search ? 'No results found' : 'No responses yet') + '</h3>' +
            '<p>' + (state.search ? 'Try adjusting your search.' : 'Once guests fill in the RSVP form, their responses will appear here.') + '</p>' +
            '</div>';
    }

    function restoreTableStructure() {
        var tableWrap = document.getElementById('rsvp-table-wrap');
        if (!tableWrap) return;
        if (!tableWrap.querySelector('table.rsvp-table')) {
            tableWrap.innerHTML = '<div class="rsvp-table-scroll"><table class="rsvp-table"><thead id="rsvp-table-head"></thead><tbody id="rsvp-table-body"></tbody></table></div>';
        }
    }

    function buildPagination(totalPages) {
        var html = '<div class="rsvp-pagination">';
        html += '<button class="rsvp-pagination-btn" data-page="' + Math.max(1, state.page - 1) + '" ' + (state.page === 1 ? 'disabled' : '') + '>';
        html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>';
        html += '</button>';

        for (var i = 1; i <= totalPages; i++) {
            if (totalPages > 7 && Math.abs(i - state.page) > 2 && i !== 1 && i !== totalPages) {
                if (i === state.page - 3 || i === state.page + 3) html += '<span style="padding:0 4px;color:var(--secondary-text)">…</span>';
                continue;
            }
            html += '<button class="rsvp-pagination-btn' + (i === state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
        }

        html += '<button class="rsvp-pagination-btn" data-page="' + Math.min(totalPages, state.page + 1) + '" ' + (state.page === totalPages ? 'disabled' : '') + '>';
        html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
        html += '</button>';
        html += '</div>';
        return html;
    }

    function renderStats() {
        var attending = 0, declining = 0;
        var adults = 0, children = 0, needTransport = 0;

        // Compute from ALL submissions (not filtered) for the KPI totals
        state.submissions.forEach(function (s) {
            var fd = s.form_data || {};
            var att = String(fd.attendance || fd.attending || fd.rsvp || '').toLowerCase();
            var isAttending = att === 'yes' || att === 'yes, i will' || att === 'joyfully accept' || att === 'attending' || att === '1';
            var isDeclining = att === 'no' || att === 'no, sorry' || att === 'regretfully decline' || att === 'not attending' || att === '0';

            if (isAttending) {
                attending++;
                var age = String(fd.ageCategory || '').toLowerCase();
                if (age === 'adult') adults++;
                else if (age === 'child') children++;
                else adults++; // default to adult if no age
                var trans = String(fd.transport || '').toLowerCase();
                if (trans === 'yes' || trans === '1') needTransport++;
            } else if (isDeclining) {
                declining++;
            }
        });

        setStatValue('stat-total', state.submissions.length);
        setStatValue('stat-attending', attending);
        setStatValue('stat-declining', declining);

        var breakdown = document.getElementById('attendingBreakdown');
        if (breakdown) {
            breakdown.innerHTML =
                '<span>Adults: <strong>' + adults + '</strong></span>' +
                '<span>Children: <strong>' + children + '</strong></span>' +
                '<span>Transport: <strong>' + needTransport + '</strong></span>';
        }

        var countLabel = document.getElementById('rsvp-count-label');
        if (countLabel) {
            countLabel.textContent = state.filtered.length + ' of ' + state.submissions.length + ' response' + (state.submissions.length !== 1 ? 's' : '');
        }
    }

    function setStatValue(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    // ----------------------------------------------------------------
    // Inline editing
    // ----------------------------------------------------------------
    function bindInlineEdit(span) {
        span.addEventListener('click', function () {
            if (span.classList.contains('editing')) return;
            var current = span.textContent.trim();
            span.classList.add('editing');
            span.setAttribute('contenteditable', 'true');
            span.focus();
            // Select all
            var range = document.createRange();
            range.selectNodeContents(span);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        });

        span.addEventListener('blur', function () {
            finishInlineEdit(span);
        });

        span.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); span.blur(); }
            if (e.key === 'Escape') {
                span.textContent = span.getAttribute('data-original') || span.textContent;
                span.classList.remove('editing');
                span.removeAttribute('contenteditable');
            }
        });

        span.addEventListener('focus', function () {
            span.setAttribute('data-original', span.textContent.trim());
        });
    }

    function finishInlineEdit(span) {
        span.classList.remove('editing');
        span.removeAttribute('contenteditable');

        var subId = parseInt(span.getAttribute('data-sub-id'));
        var field = span.getAttribute('data-field');
        var newVal = span.textContent.trim();
        var original = span.getAttribute('data-original') || '';

        if (newVal === original) return;

        var sub = state.submissions.find(function (s) { return s.id === subId; });
        if (!sub) return;

        // Table number is stored as a dedicated DB column, not inside form_data
        if (field === '__table_number') {
            var payload = { id: subId, table_number: newVal || null };
            if (state.accessToken) payload.access_token = state.accessToken;

            apiFetch('api/submissions.php', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            .then(function () {
                sub.table_number = newVal || null;
                showToast('Table saved', 'success');
            })
            .catch(function (err) {
                span.textContent = original;
                showToast(err.message || 'Save failed', 'error');
            });
            return;
        }

        var fd = Object.assign({}, sub.form_data || {});
        fd[field] = newVal;

        var payload = { id: subId, form_data: fd };
        if (state.accessToken) payload.access_token = state.accessToken;

        apiFetch('api/submissions.php', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        .then(function () {
            sub.form_data = fd;
            showToast('Saved', 'success');
        })
        .catch(function (err) {
            span.textContent = original;
            showToast(err.message || 'Save failed', 'error');
        });
    }

    function bindFixedOptionEdit(badgeEl) {
        badgeEl.addEventListener('click', function (e) {
            e.stopPropagation();
            var td = badgeEl.closest('td');
            if (!td || td.querySelector('.rsvp-badge-options-wrap')) return;
            var subId  = parseInt(badgeEl.getAttribute('data-sub-id'));
            var field  = badgeEl.getAttribute('data-field');
            var spec   = getFixedOptionSpec(field);
            if (!spec) return;
            var currentValue = badgeEl.getAttribute('data-value') || '';
            var sub = state.submissions.find(function (s) { return s.id === subId; });
            if (!sub) return;

            function getDisplayValue(fieldKey, formData) {
                var fd = formData || {};
                if (fieldKey === 'attendance') return fd.attendance || fd.attending || fd.rsvp || '';
                return fd[fieldKey] || '';
            }
            function removeMenu() {
                if (menu.parentNode) menu.parentNode.removeChild(menu);
            }
            function closeAndRevert() {
                removeMenu();
                if (!td.parentNode) return;
                var wrap = td.querySelector('.rsvp-badge-options-wrap');
                if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
                var val = getDisplayValue(field, sub.form_data);
                td.innerHTML = buildFixedOptionBadge(field, val, subId);
                td.querySelectorAll('[data-fixed-option]').forEach(bindFixedOptionEdit);
            }
            function saveAndClose(newVal) {
                var fd = Object.assign({}, sub.form_data || {});
                if (field === 'attendance') {
                    fd.attendance = newVal;
                    fd.attending = newVal;
                    fd.rsvp = newVal;
                } else {
                    fd[field] = newVal;
                }
                var payload = { id: subId, form_data: fd };
                if (state.accessToken) payload.access_token = state.accessToken;
                removeMenu();
                apiFetch('api/submissions.php', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                .then(function () {
                    sub.form_data = fd;
                    var wrap = td.querySelector('.rsvp-badge-options-wrap');
                    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
                    td.innerHTML = buildFixedOptionBadge(field, newVal, subId);
                    td.querySelectorAll('[data-fixed-option]').forEach(bindFixedOptionEdit);
                    showToast('Saved', 'success');
                })
                .catch(function (err) {
                    showToast(err.message || 'Save failed', 'error');
                    closeAndRevert();
                });
            }

            var wrap = document.createElement('div');
            wrap.className = 'rsvp-badge-options-wrap';
            wrap.appendChild(badgeEl);
            td.appendChild(wrap);

            var menu = document.createElement('div');
            menu.className = 'rsvp-badge-options-dropdown rsvp-badge-options-dropdown--fixed';

            var emptyBtn = document.createElement('button');
            emptyBtn.type = 'button';
            emptyBtn.setAttribute('data-value', '');
            emptyBtn.textContent = '—';
            if (currentValue === '') emptyBtn.classList.add('selected');
            emptyBtn.addEventListener('click', function () { saveAndClose(''); });
            menu.appendChild(emptyBtn);

            spec.options.forEach(function (o) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.setAttribute('data-value', o.value);
                btn.textContent = o.label;
                if (o.value === currentValue) btn.classList.add('selected');
                btn.addEventListener('click', function () { saveAndClose(o.value); });
                menu.appendChild(btn);
            });

            document.body.appendChild(menu);
            var rect = wrap.getBoundingClientRect();
            menu.style.left = rect.left + 'px';
            menu.style.top = (rect.bottom + 4) + 'px';

            function onDocClick(ev) {
                if (td.contains(ev.target) || menu.contains(ev.target)) return;
                document.removeEventListener('click', onDocClick);
                closeAndRevert();
            }
            setTimeout(function () {
                document.addEventListener('click', onDocClick);
            }, 0);
        });
    }

    function bindNotesEdit(span) {
        span.addEventListener('click', function () {
            if (span.querySelector('textarea')) return;
            var subId   = parseInt(span.getAttribute('data-notes-id'));
            var sub     = state.submissions.find(function (s) { return s.id === subId; });
            var current = sub ? (sub.notes || '') : '';

            var ta = document.createElement('textarea');
            ta.className = 'rsvp-notes-input';
            ta.value     = current;
            ta.placeholder = 'Add a note...';

            span.innerHTML = '';
            span.appendChild(ta);
            ta.focus();

            function save() {
                var newVal = ta.value.trim();
                var payload = { id: subId, notes: newVal || null };
                if (state.accessToken) payload.access_token = state.accessToken;

                apiFetch('api/submissions.php', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                .then(function () {
                    if (sub) sub.notes = newVal || null;
                    span.innerHTML = newVal
                        ? escHtml(newVal)
                        : '<span class="rsvp-notes-placeholder">Add note...</span>';
                    showToast('Note saved', 'success');
                })
                .catch(function (err) {
                    showToast(err.message || 'Save failed', 'error');
                    span.innerHTML = current
                        ? escHtml(current)
                        : '<span class="rsvp-notes-placeholder">Add note...</span>';
                });
            }

            ta.addEventListener('blur', save);
            ta.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') { ta.removeEventListener('blur', save); span.innerHTML = current ? escHtml(current) : '<span class="rsvp-notes-placeholder">Add note...</span>'; }
            });
        });
    }

    // ----------------------------------------------------------------
    // Delete submission
    // ----------------------------------------------------------------
    function handleDelete(id) {
        if (!confirm('Delete this RSVP response? This action cannot be undone.')) return;

        var params = 'id=' + id;
        if (state.accessToken) params += '&access_token=' + encodeURIComponent(state.accessToken);

        apiFetch('api/submissions.php?' + params, { method: 'DELETE' })
            .then(function () {
                state.submissions = state.submissions.filter(function (s) { return s.id !== id; });
                applyFilter();
                showToast('Response deleted', 'success');
            })
            .catch(function (err) {
                showToast(err.message || 'Delete failed', 'error');
            });
    }

    // ----------------------------------------------------------------
    // Group filter pills
    // ----------------------------------------------------------------
    function renderGroupFilter() {
        var wrap = document.getElementById('rsvp-group-filter');
        if (!wrap) return;

        wrap.style.display = 'flex';
        var html = '';

        // "All" — active when nothing is selected (black badge)
        var allActive = state.groupFilter.size === 0;
        html += '<button class="rsvp-cat-btn' + (allActive ? ' active' : '') + '" data-gfilter="all">All</button>';

        // Group pills — active when in Set, filled with group color
        state.groups.forEach(function (g) {
            var isActive = state.groupFilter.has(g.id);
            var inlineStyle = isActive
                ? ' style="background:' + escAttr(g.color) + ';border-color:' + escAttr(g.color) + ';color:#fff;"'
                : '';
            var dotBg = isActive ? 'rgba(255,255,255,0.85)' : escAttr(g.color);
            html += '<button class="rsvp-cat-btn' + (isActive ? ' active' : '') + '"' + inlineStyle + ' data-gfilter="' + g.id + '">';
            html += '<span class="rsvp-cat-dot" style="background:' + dotBg + '"></span>';
            html += escHtml(g.name) + '</button>';
        });

        // "No group" pill
        if (state.groups.length) {
            var noGrpActive = state.groupFilter.has(0);
            var noGrpStyle = noGrpActive
                ? ' style="background:#94a3b8;border-color:#94a3b8;color:#fff;"'
                : '';
            var noGrpDot = noGrpActive ? 'rgba(255,255,255,0.85)' : '#94a3b8';
            html += '<button class="rsvp-cat-btn' + (noGrpActive ? ' active' : '') + '"' + noGrpStyle + ' data-gfilter="0">';
            html += '<span class="rsvp-cat-dot" style="background:' + noGrpDot + '"></span>No group</button>';
        }

        html += '<button type="button" class="rsvp-cat-btn rsvp-cat-btn-add" id="rsvp-group-add-pill-btn" title="Add group">+ Group</button>';

        wrap.innerHTML = html;

        wrap.querySelectorAll('[data-gfilter]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var val = btn.getAttribute('data-gfilter');
                if (val === 'all') {
                    // Clear all → show all
                    state.groupFilter.clear();
                } else {
                    var id = parseInt(val);
                    if (state.groupFilter.has(id)) {
                        // Deselect
                        state.groupFilter.delete(id);
                    } else {
                        // Select (add to multi-select)
                        state.groupFilter.add(id);
                    }
                }
                renderGroupFilter();
                applyFilter();
            });
        });
        var addBtn = document.getElementById('rsvp-group-add-pill-btn');
        if (addBtn) addBtn.addEventListener('click', openGroupsModal);
    }

    // ----------------------------------------------------------------
    // Group selector in table rows — badge style like age category
    // ----------------------------------------------------------------
    function groupColorToBg(hex) {
        if (!hex || hex.indexOf('#') !== 0) return 'var(--secondary-bg)';
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',0.2)';
    }

    function buildGroupSelect(sub) {
        if (!state.groups.length) return '<span class="rsvp-no-groups-hint">—</span>';

        var grp = (sub.group_id !== null && sub.group_id !== undefined)
            ? state.groups.find(function (g) { return Number(g.id) === Number(sub.group_id); })
            : null;

        if (!grp) {
            return '<span class="rsvp-cell-badge rsvp-group-badge rsvp-option-other" data-group-badge data-group-sub-id="' + sub.id + '" data-group-id="" title="Click to change">No group</span>';
        }

        var bg = groupColorToBg(grp.color);
        var style = 'background:' + escAttr(bg) + ';color:' + escAttr(grp.color) + ';';
        return '<span class="rsvp-cell-badge rsvp-group-badge" data-group-badge data-group-sub-id="' + sub.id + '" data-group-id="' + grp.id + '" style="' + style + '" title="Click to change">' + escHtml(grp.name) + '</span>';
    }

    function bindGroupBadge(badgeEl) {
        badgeEl.addEventListener('click', function (e) {
            e.stopPropagation();
            var td = badgeEl.closest('td');
            if (!td || td.querySelector('.rsvp-badge-options-wrap')) return;
            var subId = parseInt(badgeEl.getAttribute('data-group-sub-id'));
            var sub = state.submissions.find(function (s) { return s.id === subId; });
            if (!sub) return;

            function removeMenu() {
                if (menu.parentNode) menu.parentNode.removeChild(menu);
            }
            function closeAndRevert() {
                removeMenu();
                var wrap = td.querySelector('.rsvp-badge-options-wrap');
                if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
                if (!td.parentNode) return;
                td.innerHTML = buildGroupSelect(sub);
                td.querySelectorAll('[data-group-badge]').forEach(bindGroupBadge);
            }
            function saveAndClose(groupId) {
                var payload = { id: subId, group_id: groupId !== '' ? parseInt(groupId) : null };
                if (state.accessToken) payload.access_token = state.accessToken;
                removeMenu();
                apiFetch('api/submissions.php', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                .then(function () {
                    sub.group_id = groupId !== '' ? parseInt(groupId) : null;
                    var wrap = td.querySelector('.rsvp-badge-options-wrap');
                    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
                    td.innerHTML = buildGroupSelect(sub);
                    td.querySelectorAll('[data-group-badge]').forEach(bindGroupBadge);
                    showToast('Group assigned', 'success');
                })
                .catch(function (err) {
                    showToast(err.message || 'Save failed', 'error');
                    closeAndRevert();
                });
            }

            var wrap = document.createElement('div');
            wrap.className = 'rsvp-badge-options-wrap';
            wrap.appendChild(badgeEl);
            td.appendChild(wrap);

            var menu = document.createElement('div');
            menu.className = 'rsvp-badge-options-dropdown rsvp-badge-options-dropdown--fixed';

            var noGroupBtn = document.createElement('button');
            noGroupBtn.type = 'button';
            noGroupBtn.setAttribute('data-value', '');
            noGroupBtn.textContent = 'No group';
            if (sub.group_id === null || sub.group_id === undefined) noGroupBtn.classList.add('selected');
            noGroupBtn.addEventListener('click', function () { saveAndClose(''); });
            menu.appendChild(noGroupBtn);

            state.groups.forEach(function (g) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.setAttribute('data-value', String(g.id));
                btn.textContent = g.name;
                if (sub.group_id !== null && Number(sub.group_id) === Number(g.id)) btn.classList.add('selected');
                btn.addEventListener('click', function () { saveAndClose(String(g.id)); });
                menu.appendChild(btn);
            });

            document.body.appendChild(menu);
            var rect = wrap.getBoundingClientRect();
            menu.style.left = rect.left + 'px';
            menu.style.top = (rect.bottom + 4) + 'px';

            function onDocClick(ev) {
                if (td.contains(ev.target) || menu.contains(ev.target)) return;
                document.removeEventListener('click', onDocClick);
                closeAndRevert();
            }
            setTimeout(function () {
                document.addEventListener('click', onDocClick);
            }, 0);
        });
    }

    // ----------------------------------------------------------------
    // Group management modal
    // ----------------------------------------------------------------
    function openGroupsModal() {
        var modal = document.getElementById('modal-manage-groups');
        if (!modal) return;

        renderGroupsList();
        openModal(modal);

        var addBtn = document.getElementById('add-group-btn');
        var nameInput = document.getElementById('new-group-name');

        // Re-bind add button
        var newAddBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newAddBtn, addBtn);

        newAddBtn.addEventListener('click', function () {
            var name = nameInput ? nameInput.value.trim() : '';
            if (!name) { showToast('Please enter a group name', 'error'); return; }

            newAddBtn.disabled = true;

            var payload = { page_id: state.pageId, action: 'create-group', name: name, color: selectedGroupColor };
            if (state.accessToken) payload.access_token = state.accessToken;

            apiFetch('api/submissions.php?action=create-group', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            .then(function (data) {
                state.groups.push(data.group);
                if (nameInput) nameInput.value = '';
                renderGroupsList();
                renderGroupFilter();
                showToast('Group "' + data.group.name + '" created', 'success');
            })
            .catch(function (err) {
                showToast(err.message || 'Could not create group', 'error');
            })
            .finally(function () { newAddBtn.disabled = false; });
        });

        if (nameInput) {
            nameInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); newAddBtn.click(); }
            });
        }
    }

    function renderGroupsList() {
        var list = document.getElementById('groups-list');
        if (!list) return;

        if (!state.groups.length) {
            list.innerHTML = '<p class="rsvp-groups-empty">No groups yet. Create your first one below.</p>';
            return;
        }

        var html = '';
        state.groups.forEach(function (g) {
            html += '<div class="rsvp-group-item" data-gid="' + g.id + '">';
            html += '<span class="rsvp-group-color-dot" style="background:' + escAttr(g.color) + '"></span>';
            html += '<span class="rsvp-group-item-name">' + escHtml(g.name) + '</span>';
            // Count members
            var count = state.submissions.filter(function (s) { return s.group_id === g.id; }).length;
            html += '<span class="rsvp-group-item-count">' + count + ' guest' + (count !== 1 ? 's' : '') + '</span>';
            html += '<button class="rsvp-group-delete-btn" data-gid="' + g.id + '" title="Delete group">';
            html += '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
            html += '</button>';
            html += '</div>';
        });
        list.innerHTML = html;

        list.querySelectorAll('[data-gid]').forEach(function (btn) {
            if (!btn.classList.contains('rsvp-group-delete-btn')) return;
            btn.addEventListener('click', function () {
                var gid = parseInt(btn.getAttribute('data-gid'));
                var grp = state.groups.find(function (g) { return g.id === gid; });
                if (!grp) return;
                if (!confirm('Delete group "' + grp.name + '"? Guests in this group will become unassigned.')) return;

                var params = 'action=delete-group&id=' + gid;
                if (state.accessToken) params += '&access_token=' + encodeURIComponent(state.accessToken);

                apiFetch('api/submissions.php?' + params, { method: 'DELETE' })
                    .then(function () {
                        // Unassign submissions in memory
                        state.submissions.forEach(function (s) {
                            if (s.group_id === gid) s.group_id = null;
                        });
                        state.groups = state.groups.filter(function (g) { return g.id !== gid; });
                        // Remove from multi-select filter if it was active
                        state.groupFilter.delete(gid);
                        renderGroupsList();
                        renderGroupFilter();
                        applyFilter();
                        showToast('Group deleted', 'success');
                    })
                    .catch(function (err) {
                        showToast(err.message || 'Could not delete group', 'error');
                    });
            });
        });
    }

    // ----------------------------------------------------------------
    // Color swatches for the group modal
    // ----------------------------------------------------------------
    function renderColorSwatches() {
        var wrap = document.getElementById('group-color-swatches');
        if (!wrap) return;
        var html = '';
        GROUP_COLORS.forEach(function (c) {
            var active = (c === selectedGroupColor) ? ' active' : '';
            html += '<button type="button" class="rsvp-swatch' + active + '" data-color="' + c + '" style="background:' + c + '" title="' + c + '"></button>';
        });
        wrap.innerHTML = html;
        wrap.querySelectorAll('[data-color]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                selectedGroupColor = btn.getAttribute('data-color');
                wrap.querySelectorAll('.rsvp-swatch').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
            });
        });
    }

    // ----------------------------------------------------------------
    // Top bar actions
    // ----------------------------------------------------------------
    function bindTopBarActions() {
        // Search
        var searchEl = document.getElementById('rsvp-search');
        if (searchEl) {
            searchEl.addEventListener('input', function () {
                state.search = this.value;
                applyFilter();
            });
        }

        // Toggle form open/close
        var toggleBtn = document.getElementById('rsvp-toggle-form-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function () {
                handleDirectToggleForm();
            });
        }

        // Share access link
        var shareBtn = document.getElementById('rsvp-share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', function () {
                openShareModal();
            });
        }

        // Print: same content as Export -> PDF, opens print dialog
        var printBtn = document.getElementById('rsvp-print-btn');
        if (printBtn) {
            printBtn.addEventListener('click', function () {
                handlePrintAsPDF();
            });
        }

        // Export dropdown
        var exportBtn = document.getElementById('rsvp-export-btn');
        var exportMenu = document.getElementById('rsvp-export-menu');
        if (exportBtn && exportMenu) {
            exportBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var isOpen = exportMenu.classList.contains('open');
                exportMenu.classList.toggle('open', !isOpen);
                if (!isOpen) {
                    exportMenu.style.width = exportBtn.offsetWidth + 'px';
                }
            });
            exportMenu.querySelectorAll('[data-export]').forEach(function (item) {
                item.addEventListener('click', function (e) {
                    e.stopPropagation();
                    exportMenu.classList.remove('open');
                    var type = item.getAttribute('data-export');
                    if (type === 'csv') handleExportCSV();
                    else if (type === 'excel') handleExportExcel();
                    else if (type === 'pdf') handleExportPDF();
                });
            });
        }

        // Close filter dropdowns and export menu on outside click
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.rsvp-th-filter-icon') && !e.target.closest('.rsvp-col-filter-dropdown')) {
                closeAllFilterDropdowns();
            }
            if (!e.target.closest('.rsvp-export-dropdown-wrap')) {
                var menu = document.getElementById('rsvp-export-menu');
                if (menu) menu.classList.remove('open');
            }
        });
    }

    // ---- Direct lock-icon toggle (no modal) ------------------------
    function handleDirectToggleForm() {
        var btn = document.getElementById('rsvp-toggle-form-btn');
        if (btn) btn.disabled = true;

        var newState  = !state.formOpen;
        // When closing, keep the existing saved message (or use a sensible default)
        var closedMsg = state.formClosedMessage || 'We are no longer accepting RSVPs. Thank you!';
        var payload   = {
            page_id: state.pageId,
            action: 'toggle-form',
            form_open: newState,
            form_closed_message: closedMsg,
        };
        if (state.accessToken) payload.access_token = state.accessToken;

        apiFetch('api/submissions.php?action=toggle-form', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        .then(function (data) {
            state.formOpen = data.form_open;
            updateFormStatusBadge();
            showToast('Form is now ' + (state.formOpen ? 'open' : 'closed'), 'success');
        })
        .catch(function (err) {
            showToast(err.message || 'Error', 'error');
        })
        .finally(function () {
            if (btn) btn.disabled = false;
        });
    }

    // [DISABLED_FOR_WEDDING_VERSION]: Modal-based toggle replaced by direct lock-icon toggle.
    // Keep for future reactivation if a custom closed-message prompt is needed again.
    function openToggleFormModal() {
        var modal = document.getElementById('modal-toggle-form');
        if (!modal) return;

        var msgInput = document.getElementById('form-closed-message-input');
        var statusTxt = document.getElementById('toggle-form-status-text');
        var actionBtn = document.getElementById('toggle-form-confirm-btn');

        if (msgInput) msgInput.value = state.formClosedMessage || 'We are no longer accepting RSVPs. Thank you!';

        updateToggleFormUI(statusTxt, actionBtn, msgInput);
        openModal(modal);

        // Re-bind (avoids duplicate listeners)
        var newBtn = actionBtn.cloneNode(true);
        actionBtn.parentNode.replaceChild(newBtn, actionBtn);
        newBtn.addEventListener('click', function () {
            var newState  = !state.formOpen;
            var closedMsg = (msgInput ? msgInput.value.trim() : '') || null;
            var payload   = { page_id: state.pageId, action: 'toggle-form', form_open: newState, form_closed_message: closedMsg };
            if (state.accessToken) payload.access_token = state.accessToken;

            apiFetch('api/submissions.php?action=toggle-form', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            .then(function (data) {
                state.formOpen = data.form_open;
                state.formClosedMessage = closedMsg || '';
                updateFormStatusBadge();
                closeModal(modal);
                showToast('Form is now ' + (state.formOpen ? 'open' : 'closed'), 'success');
            })
            .catch(function (err) {
                showToast(err.message || 'Error', 'error');
            });
        });
    }

    function updateToggleFormUI(statusTxt, actionBtn, msgInput) {
        if (statusTxt) statusTxt.textContent = state.formOpen ? 'Currently OPEN — guests can submit responses.' : 'Currently CLOSED — no new responses are accepted.';
        if (actionBtn) actionBtn.textContent = state.formOpen ? 'Close the form' : 'Open the form';
        if (actionBtn) actionBtn.className   = 'rsvp-btn ' + (state.formOpen ? 'rsvp-btn-danger' : 'rsvp-btn-success');
        if (msgInput)  msgInput.style.display = state.formOpen ? 'block' : 'none';
    }

    // ---- Share access link modal -----------------------------------
    function openShareModal() {
        var modal = document.getElementById('modal-share-link');
        if (!modal) return;

        var emailInput  = document.getElementById('share-email-input');
        var linkResult  = document.getElementById('share-link-result');
        var copyBtn     = document.getElementById('share-link-copy-btn');
        var generateBtn = document.getElementById('share-link-generate-btn');

        if (linkResult)  { linkResult.textContent = ''; linkResult.classList.remove('visible'); }
        if (emailInput)  emailInput.value = '';
        if (copyBtn)     copyBtn.style.display = 'none';

        openModal(modal);

        var newBtn = generateBtn.cloneNode(true);
        generateBtn.parentNode.replaceChild(newBtn, generateBtn);

        newBtn.addEventListener('click', function () {
            newBtn.disabled = true;
            newBtn.textContent = 'Generating...';

            var payload = { page_id: state.pageId, action: 'create-access-link', email: emailInput ? emailInput.value.trim() : '' };
            if (state.accessToken) payload.access_token = state.accessToken;

            apiFetch('api/submissions.php?action=create-access-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            .then(function (data) {
                if (linkResult) { linkResult.textContent = data.url; linkResult.classList.add('visible'); }
                if (copyBtn) {
                    copyBtn.style.display = 'inline-flex';
                    copyBtn.onclick = function () {
                        navigator.clipboard.writeText(data.url).then(function () {
                            copyBtn.textContent = 'Copied!';
                            setTimeout(function () { copyBtn.textContent = 'Copy link'; }, 2000);
                        });
                    };
                }
                showToast('Private link created', 'success');
            })
            .catch(function (err) {
                showToast(err.message || 'Error creating link', 'error');
            })
            .finally(function () {
                newBtn.disabled  = false;
                newBtn.textContent = 'Generate link';
            });
        });
    }

    // ---- Export helpers -----------------------------------------------

    function getExportData() {
        var cols = getFormColumns();
        var allCols = getAllColumns(cols);
        // Exclude non-data columns (actions)
        allCols = allCols.filter(function (c) { return c.key !== 'actions'; });

        var headers = allCols.map(function (c) { return c.label || formatColLabel(c.key); });
        var rows = [];
        state.filtered.forEach(function (sub) {
            var fd = sub.form_data || {};
            var row = [];
            allCols.forEach(function (c) {
                if (c.key === 'group') {
                    var grp = sub.group_id ? state.groups.find(function (g) { return g.id === sub.group_id; }) : null;
                    row.push(grp ? grp.name : '');
                } else if (c.key === 'table') {
                    row.push(sub.table_number || '');
                } else if (c.key === 'notes') {
                    row.push(sub.notes || '');
                } else if (c.key === 'date') {
                    row.push(sub.submitted_at ? formatDate(sub.submitted_at) : '');
                } else {
                    row.push(fd[c.key] !== undefined ? String(fd[c.key]) : '');
                }
            });
            rows.push(row);
        });
        return { headers: headers, rows: rows, columns: allCols };
    }

    function handleExportCSV() {
        var params = 'action=export&page_id=' + encodeURIComponent(state.pageId);
        if (state.accessToken) params += '&access_token=' + encodeURIComponent(state.accessToken);
        window.location.href = 'api/submissions.php?' + params;
    }

    function handleExportExcel() {
        if (typeof XLSX === 'undefined') {
            showToast('Excel library not loaded', 'error');
            return;
        }
        var data = getExportData();
        var wsData = [data.headers].concat(data.rows);
        var ws = XLSX.utils.aoa_to_sheet(wsData);

        // Auto-size columns
        var colWidths = data.headers.map(function (h, i) {
            var max = h.length;
            data.rows.forEach(function (r) {
                var len = (r[i] || '').length;
                if (len > max) max = len;
            });
            return { wch: Math.min(max + 2, 40) };
        });
        ws['!cols'] = colWidths;

        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'RSVP');

        var filename = (state.pageTitle || 'rsvp').replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        XLSX.writeFile(wb, filename);
        showToast('Excel downloaded', 'success');
    }

    /**
     * Builds the same PDF document used for Export -> PDF (title, date, table).
     * Returns the jsPDF instance or null if the library is not loaded.
     */
    function buildExportPDFDoc() {
        var JsPDFConstructor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        if (!JsPDFConstructor) return null;
        var doc = new JsPDFConstructor({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        var data = getExportData();

        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        var title = state.pageTitle || 'RSVP Responses';
        doc.text(title, 14, 15);

        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(120, 120, 120);
        var dateStr = 'Generated on ' + new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.text(dateStr, 14, 21);
        doc.setTextColor(0, 0, 0);

        doc.autoTable({
            head: [data.headers],
            body: data.rows,
            startY: 26,
            theme: 'grid',
            styles: {
                fontSize: 7.5,
                cellPadding: 2.5,
                overflow: 'linebreak',
                lineColor: [220, 220, 220],
                lineWidth: 0.3,
            },
            headStyles: {
                fillColor: [40, 40, 40],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 7.5,
            },
            alternateRowStyles: {
                fillColor: [248, 249, 250],
            },
            margin: { left: 14, right: 14 },
        });
        return doc;
    }

    function handleExportPDF() {
        var doc = buildExportPDFDoc();
        if (!doc) {
            showToast('PDF library not loaded', 'error');
            return;
        }
        var filename = (state.pageTitle || 'rsvp').replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
        doc.save(filename);
        showToast('PDF downloaded', 'success');
    }

    /**
     * Opens the same PDF as Export -> PDF in a new context and triggers the print dialog.
     */
    function handlePrintAsPDF() {
        var doc = buildExportPDFDoc();
        if (!doc) {
            showToast('PDF library not loaded', 'error');
            return;
        }
        var blob = doc.output('blob');
        var url = URL.createObjectURL(blob);
        var iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;';
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = function () {
            try {
                iframe.contentWindow.print();
            } catch (e) {
                window.open(url, '_blank');
                showToast('Open the new tab and use Ctrl+P to print', 'info');
            }
            setTimeout(function () {
                URL.revokeObjectURL(url);
                if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            }, 1000);
        };
    }

    // ----------------------------------------------------------------
    // UI helpers
    // ----------------------------------------------------------------
    function updatePageTitle() {
        // Main title "List of Assistants"; subtitle shows full domain (no protocol) below, link to website when available
        var subtitleEl = document.getElementById('rsvp-page-subtitle');
        if (subtitleEl) {
            var displayUrl = (state.pageUrl || '').replace(/^https?:\/\//i, '');
            subtitleEl.textContent = displayUrl;
            subtitleEl.style.display = displayUrl ? 'block' : 'none';
            subtitleEl.href = state.pageUrl || 'javascript:void(0)';
            if (state.pageUrl) {
                subtitleEl.setAttribute('target', '_blank');
                subtitleEl.setAttribute('rel', 'noopener noreferrer');
            } else {
                subtitleEl.removeAttribute('target');
                subtitleEl.removeAttribute('rel');
            }
        }
        document.title = (state.pageTitle ? state.pageTitle + ' \u2014 ' : '') + 'RSVP Dashboard';

        var printSub = document.getElementById('rsvp-print-subtitle');
        if (printSub) {
            printSub.textContent = state.pageUrl || state.pageTitle || '';
            printSub.style.display = (state.pageUrl || state.pageTitle) ? 'block' : 'none';
            printSub.href = state.pageUrl || '#';
            if (state.pageUrl) printSub.setAttribute('target', '_blank');
        }

        // Back to editor link: include page id so we return to the same page
        var backEl = document.getElementById('rsvp-back-to-editor');
        if (backEl) {
            backEl.href = state.pageId ? 'app.php?page=' + encodeURIComponent(state.pageId) : 'app.php';
        }
    }

    function updateFormStatusBadge() {
        var btn = document.getElementById('rsvp-toggle-form-btn');
        if (btn) {
            btn.className = 'rsvp-form-status ' + (state.formOpen ? 'open' : 'closed');

            var textEl = document.getElementById('form-status-text');
            if (textEl) textEl.textContent = state.formOpen ? 'Form open' : 'Form closed';

            var iconOpen   = btn.querySelector('.lock-icon-open');
            var iconClosed = btn.querySelector('.lock-icon-closed');
            if (iconOpen)   iconOpen.style.display   = state.formOpen ? '' : 'none';
            if (iconClosed) iconClosed.style.display = state.formOpen ? 'none' : '';
            btn.title = state.formOpen ? 'Close the RSVP form' : 'Open the RSVP form';
        }
    }

    function showLoading(show) {
        var loadingEl  = document.getElementById('rsvp-loading');
        var contentEl  = document.getElementById('rsvp-content');
        if (loadingEl) loadingEl.style.display = show ? 'flex' : 'none';
        if (contentEl) contentEl.style.display = show ? 'none' : 'block';
    }

    function showGlobalError(msg) {
        showLoading(false);
        var el = document.getElementById('rsvp-global-error');
        if (el) { el.textContent = msg; el.style.display = 'block'; }
    }

    function openModal(modal) {
        modal.classList.add('open');
        // Close on overlay click
        modal.addEventListener('click', function onOverlayClick(e) {
            if (e.target === modal) { closeModal(modal); modal.removeEventListener('click', onOverlayClick); }
        });
        // Close button
        var closeBtn = modal.querySelector('[data-modal-close]');
        if (closeBtn) {
            var newClose = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newClose, closeBtn);
            newClose.addEventListener('click', function () { closeModal(modal); });
        }
    }

    function closeModal(modal) { modal.classList.remove('open'); }

    function showToast(message, type) {
        var toast = document.getElementById('rsvp-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className   = 'rsvp-toast ' + (type || '');
        toast.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(function () { toast.classList.remove('show'); }, 3000);
    }

    // ----------------------------------------------------------------
    // Fixed-option fields: display as coloured badges, edit via dropdown
    // ----------------------------------------------------------------
    var FIXED_OPTION_FIELDS = {
        attendance: {
            options: [
                { value: 'yes', label: 'Yes, I will', badgeClass: 'rsvp-option-attendance-yes' },
                { value: 'no',  label: 'No, sorry',  badgeClass: 'rsvp-option-attendance-no' },
            ],
            // Normalize legacy/form variants to canonical value for display and save
            normalizeValue: function (v) {
                var s = String(v || '').toLowerCase().trim();
                if (s === 'yes' || s === 'yes, i will' || s === 'joyfully accept' || s === 'attending' || s === '1') return 'yes';
                if (s === 'no' || s === 'no, sorry' || s === 'regretfully decline' || s === 'not attending' || s === '0') return 'no';
                return s || '';
            },
        },
        ageCategory: {
            options: [
                { value: 'adult',  label: 'Adult',  badgeClass: 'rsvp-option-age-adult' },
                { value: 'child',  label: 'Child',  badgeClass: 'rsvp-option-age-child' },
            ],
            normalizeValue: function (v) {
                var s = String(v || '').toLowerCase().trim();
                if (s === 'adult')  return 'adult';
                if (s === 'child')  return 'child';
                return s || '';
            },
        },
        transport: {
            options: [
                { value: 'yes', label: 'Yes', badgeClass: 'rsvp-option-transport-yes' },
                { value: 'no',  label: 'No',  badgeClass: 'rsvp-option-transport-no' },
            ],
            normalizeValue: function (v) {
                var s = String(v || '').toLowerCase().trim();
                if (s === 'yes' || s === '1') return 'yes';
                if (s === 'no' || s === '0') return 'no';
                return s || '';
            },
        },
    };

    function getFixedOptionSpec(fieldKey) {
        return FIXED_OPTION_FIELDS[fieldKey] || null;
    }

    function getOptionByValue(fieldKey, value) {
        var spec = getFixedOptionSpec(fieldKey);
        if (!spec) return null;
        var canonical = spec.normalizeValue ? spec.normalizeValue(value) : String(value || '').toLowerCase();
        var opt = spec.options.find(function (o) { return o.value === canonical; });
        if (opt) return opt;
        // Unknown value: still show as badge with neutral class
        return { value: canonical || value, label: String(value || '').trim() || '—', badgeClass: 'rsvp-option-other' };
    }

    function buildFixedOptionBadge(fieldKey, value, subId) {
        var spec = getFixedOptionSpec(fieldKey);
        var opt = spec ? getOptionByValue(fieldKey, value) : null;
        if (!opt) return escHtml(String(value || ''));
        var label = opt.label || opt.value;
        var cls = opt.badgeClass || 'rsvp-option-other';
        return '<span class="rsvp-cell-badge ' + escAttr(cls) + '" data-fixed-option data-sub-id="' + subId + '" data-field="' + escAttr(fieldKey) + '" data-value="' + escAttr(opt.value) + '" title="Click to change">' + escHtml(label) + '</span>';
    }

    function isFixedOptionField(col) {
        return FIXED_OPTION_FIELDS.hasOwnProperty(col) || col === 'attending' || col === 'rsvp';
    }

    function resolveFixedOptionFieldKey(col) {
        if (col === 'attending' || col === 'rsvp') return 'attendance';
        return col;
    }

    // ----------------------------------------------------------------
    // Columns — fixed set matching the standard 9-field RSVP form
    // ----------------------------------------------------------------

    // Canonical field order and human-readable labels.
    // The user can remove fields from a template, but these are the only
    // fields that will ever appear in the dashboard.
    var FORM_COLUMNS = [
        { key: 'attendance',  label: '',                filterable: true  },
        { key: 'fullName',    label: 'Full Name',       filterable: false },
        { key: 'mobile',      label: 'Mobile',          filterable: false },
        { key: 'email',       label: 'Email',           filterable: false },
        { key: 'ageCategory', label: 'Age Category',    filterable: true  },
        { key: 'allergies',   label: 'Allergies / Diet',filterable: false },
        { key: 'transport',   label: 'Transport',       filterable: true  },
        { key: 'song',        label: 'Song',            filterable: false },
        { key: 'message',     label: 'Message',         filterable: false },
    ];

    var EXTRA_COLUMNS = [
        { key: 'group',  label: 'Group', filterable: true  },
        { key: 'table',  label: 'Table', filterable: true  },
    ];

    function getFormColumns() {
        // Return only the columns that appear in at least one submission,
        // preserving the canonical order defined above.
        var presentKeys = {};
        state.submissions.forEach(function (s) {
            Object.keys(s.form_data || {}).forEach(function (k) { presentKeys[k] = true; });
        });

        // Always include the 9 canonical columns (show empty cells for missing values).
        // Unknown keys from dirty data are silently ignored.
        return FORM_COLUMNS.filter(function (col) {
            return presentKeys[col.key] !== undefined || state.submissions.length === 0;
        }).map(function (col) { return col.key; });
    }

    function formatColLabel(key) {
        // Use the canonical label if available; fall back to auto-format for edge cases.
        var col = FORM_COLUMNS.find(function (c) { return c.key === key; });
        if (col) return col.label;
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/[_-]/g, ' ')
            .replace(/\b\w/g, function (c) { return c.toUpperCase(); })
            .trim();
    }

    function formatDate(str) {
        if (!str) return '';
        var d = new Date(str);
        if (isNaN(d.getTime())) return str;
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
               ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }

    // ----------------------------------------------------------------
    // Dark mode (Modo Boda) – mirrors app.php behaviour
    // ----------------------------------------------------------------
    function setupDarkMode() {
        var saved = localStorage.getItem('darkMode');
        if (saved === 'true') document.body.classList.add('dark-mode');
    }

    // ----------------------------------------------------------------
    // User menu – mirrors app.php behaviour
    // ----------------------------------------------------------------
    function setupUserMenu() {
        var trigger  = document.getElementById('server-user-display');
        var dropdown = document.getElementById('server-user-dropdown');
        if (!trigger || !dropdown) return;

        function toggleMenu(open) {
            trigger.setAttribute('aria-expanded', String(open));
            dropdown.setAttribute('aria-hidden', String(!open));
            if (open) dropdown.classList.add('open');
            else       dropdown.classList.remove('open');
        }

        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            var isOpen = trigger.getAttribute('aria-expanded') === 'true';
            toggleMenu(!isOpen);
        });

        document.addEventListener('click', function () { toggleMenu(false); });

        dropdown.querySelectorAll('[data-menu-action]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var action = btn.getAttribute('data-menu-action');
                if (action === 'logout') {
                    window.location.href = 'logout.php';
                } else if (action === 'manage') {
                    if (window.Clerk && window.Clerk.openUserProfile) window.Clerk.openUserProfile();
                } else if (action === 'darkmode') {
                    document.body.classList.toggle('dark-mode');
                    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode') ? 'true' : 'false');
                    toggleMenu(false);
                } else if (action === 'upgrade') {
                    window.location.href = '/subscribe';
                }
            });
        });
    }

    // ----------------------------------------------------------------
    // Escape helpers
    // ----------------------------------------------------------------
    function escHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escAttr(s) { return escHtml(s); }

    // ----------------------------------------------------------------
    // Start
    // ----------------------------------------------------------------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
