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
        groupFilter: null, // null = all, or group id (int) to filter
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
                state.groups         = data.groups || [];

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
            // Group filter
            if (state.groupFilter !== null) {
                if (state.groupFilter === 0) {
                    // Unassigned guests only
                    if (s.group_id !== null && s.group_id !== undefined) return false;
                } else {
                    if (s.group_id !== state.groupFilter) return false;
                }
            }
            // Text search
            if (!q) return true;
            var fd = s.form_data || {};
            var haystack = Object.values(fd).join(' ').toLowerCase()
                + ' ' + (s.notes || '').toLowerCase()
                + ' ' + (s.table_number || '').toLowerCase();
            return haystack.indexOf(q) !== -1;
        });
        state.page = 1;
        renderTable();
        renderStats();
    }

    function renderTable() {
        var tableWrap = document.getElementById('rsvp-table-wrap');
        if (!tableWrap) return;

        var start = (state.page - 1) * state.perPage;
        var pageItems = state.filtered.slice(start, start + state.perPage);

        // Derive dynamic columns from all submissions
        var cols = getFormColumns();

        if (!state.filtered.length) {
            tableWrap.innerHTML = buildEmptyState();
            return;
        }

        var html = '<div class="rsvp-table-scroll"><table class="rsvp-table">';

        // Header
        html += '<thead><tr>';
        cols.forEach(function (col) {
            html += '<th>' + escHtml(formatColLabel(col)) + '</th>';
        });
        html += '<th class="col-group">Group</th>';
        html += '<th class="col-table">Table</th>';
        html += '<th class="col-notes">Notes</th>';
        html += '<th class="col-date">Submitted</th>';
        html += '<th class="col-actions"></th>';
        html += '</tr></thead>';

        // Body
        html += '<tbody>';
        pageItems.forEach(function (sub) {
            html += buildRow(sub, cols);
        });
        html += '</tbody></table></div>';

        // Pagination
        var totalPages = Math.ceil(state.filtered.length / state.perPage);
        if (totalPages > 1) {
            html += buildPagination(totalPages);
        }

        tableWrap.innerHTML = html;

        // Bind inline edit events
        tableWrap.querySelectorAll('[data-editable]').forEach(bindInlineEdit);
        tableWrap.querySelectorAll('[data-notes-id]').forEach(bindNotesEdit);
        tableWrap.querySelectorAll('[data-group-sub-id]').forEach(bindGroupSelect);
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

    function buildRow(sub, cols) {
        var fd = sub.form_data || {};
        var html = '<tr data-id="' + sub.id + '">';

        cols.forEach(function (col) {
            var val = fd[col] !== undefined ? fd[col] : '';
            if (col === 'attending' || col === 'attendance' || col === 'rsvp') {
                html += '<td>' + buildAttendingBadge(val) + '</td>';
            } else {
                html += '<td><span class="rsvp-cell-editable" data-editable data-sub-id="' + sub.id + '" data-field="' + escAttr(col) + '">' + escHtml(String(val)) + '</span></td>';
            }
        });

        // Group selector
        html += '<td class="col-group-cell">' + buildGroupSelect(sub) + '</td>';

        // Table number (inline-editable like other fields, stored in table_number column)
        var tnum = sub.table_number || '';
        html += '<td><span class="rsvp-cell-editable rsvp-table-number-cell" data-editable data-sub-id="' + sub.id + '" data-field="__table_number">' + escHtml(tnum) + '</span></td>';

        // Notes
        var notes = sub.notes || '';
        html += '<td>';
        html += '<span class="rsvp-cell-editable rsvp-notes-cell" data-notes-id="' + sub.id + '">';
        if (notes) {
            html += escHtml(notes);
        } else {
            html += '<span class="rsvp-notes-placeholder">Add note...</span>';
        }
        html += '</span>';
        html += '</td>';

        // Date
        html += '<td class="rsvp-date">' + formatDate(sub.submitted_at) + '</td>';

        // Actions
        html += '<td><button class="rsvp-row-delete-btn" data-delete-id="' + sub.id + '" title="Delete submission">';
        html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
        html += '</button></td>';

        html += '</tr>';
        return html;
    }

    function buildAttendingBadge(val) {
        var v = String(val).toLowerCase();
        if (v === 'yes' || v === 'joyfully accept' || v === 'attending' || v === '1') {
            return '<span class="rsvp-attending-yes">✓ Yes</span>';
        } else if (v === 'no' || v === 'regretfully decline' || v === 'not attending' || v === '0') {
            return '<span class="rsvp-attending-no">✗ No</span>';
        }
        return escHtml(val);
    }

    function buildEmptyState() {
        return '<div class="rsvp-empty">' +
            '<div class="rsvp-empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="11" y2="16"/></svg></div>' +
            '<h3>' + (state.search ? 'No results found' : 'No responses yet') + '</h3>' +
            '<p>' + (state.search ? 'Try adjusting your search.' : 'Once guests fill in the RSVP form, their responses will appear here.') + '</p>' +
            '</div>';
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
        var attending = 0, declining = 0, totalGuests = 0;
        state.filtered.forEach(function (s) {
            var fd = s.form_data || {};
            var att = String(fd.attending || fd.attendance || fd.rsvp || '').toLowerCase();
            if (att === 'yes' || att === 'joyfully accept' || att === 'attending' || att === '1') {
                attending++;
                totalGuests += parseInt(fd.guests || fd.numberOfGuests || '1') || 1;
            } else if (att && att !== '') {
                declining++;
            }
        });

        setStatValue('stat-total',    state.filtered.length);
        setStatValue('stat-attending', attending);
        setStatValue('stat-declining', declining);
        setStatValue('stat-guests',    totalGuests);

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

        if (!state.groups.length) {
            wrap.style.display = 'none';
            return;
        }

        wrap.style.display = 'flex';
        var html = '';
        html += '<button class="rsvp-group-pill' + (state.groupFilter === null ? ' active' : '') + '" data-gfilter="all">All</button>';
        state.groups.forEach(function (g) {
            var active = state.groupFilter === g.id ? ' active' : '';
            html += '<button class="rsvp-group-pill' + active + '" data-gfilter="' + g.id + '" style="--pill-color:' + escAttr(g.color) + '">';
            html += '<span class="rsvp-pill-dot" style="background:' + escAttr(g.color) + '"></span>';
            html += escHtml(g.name) + '</button>';
        });
        // Unassigned shortcut
        html += '<button class="rsvp-group-pill' + (state.groupFilter === 0 ? ' active' : '') + '" data-gfilter="0" style="--pill-color:#94a3b8">';
        html += '<span class="rsvp-pill-dot" style="background:#94a3b8"></span>No group</button>';

        wrap.innerHTML = html;

        wrap.querySelectorAll('[data-gfilter]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var val = btn.getAttribute('data-gfilter');
                state.groupFilter = val === 'all' ? null : parseInt(val);
                renderGroupFilter();
                applyFilter();
            });
        });
    }

    // ----------------------------------------------------------------
    // Group selector in table rows
    // ----------------------------------------------------------------
    function buildGroupSelect(sub) {
        if (!state.groups.length) return '<span class="rsvp-no-groups-hint">—</span>';

        var html = '<select class="rsvp-group-select" data-group-sub-id="' + sub.id + '">';
        html += '<option value="">No group</option>';
        state.groups.forEach(function (g) {
            var selected = (sub.group_id !== null && sub.group_id !== undefined && Number(sub.group_id) === Number(g.id)) ? ' selected' : '';
            html += '<option value="' + g.id + '"' + selected + '>' + escHtml(g.name) + '</option>';
        });
        html += '</select>';
        return html;
    }

    function bindGroupSelect(select) {
        select.addEventListener('change', function () {
            var subId   = parseInt(select.getAttribute('data-group-sub-id'));
            var groupId = select.value ? parseInt(select.value) : null;
            var sub     = state.submissions.find(function (s) { return s.id === subId; });
            if (!sub) return;

            var payload = { id: subId, group_id: groupId };
            if (state.accessToken) payload.access_token = state.accessToken;

            apiFetch('api/submissions.php', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            .then(function () {
                sub.group_id = groupId;
                // Update dot color on the select
                updateGroupSelectStyle(select, groupId);
                showToast('Group assigned', 'success');
            })
            .catch(function (err) {
                showToast(err.message || 'Save failed', 'error');
                // Revert
                select.value = sub.group_id !== null ? String(sub.group_id) : '';
            });
        });
        // Apply initial color
        var sub = state.submissions.find(function (s) { return s.id === parseInt(select.getAttribute('data-group-sub-id')); });
        if (sub) updateGroupSelectStyle(select, sub.group_id);
    }

    function updateGroupSelectStyle(select, groupId) {
        var grp = groupId !== null ? state.groups.find(function (g) { return g.id === groupId; }) : null;
        select.style.borderLeftColor = grp ? grp.color : 'transparent';
        select.style.borderLeftWidth = grp ? '3px' : '1px';
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
                        // Reset filter if we were filtering by this group
                        if (state.groupFilter === gid) state.groupFilter = null;
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

        // Toggle form open/close — direct toggle via lock icon (no modal)
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

        // Export CSV
        var exportBtn = document.getElementById('rsvp-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', function () {
                handleExport();
            });
        }

        // Manage guest groups
        var groupsBtn = document.getElementById('rsvp-groups-btn');
        if (groupsBtn) {
            groupsBtn.addEventListener('click', function () {
                openGroupsModal();
            });
        }
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

    // ---- CSV export -----------------------------------------------
    function handleExport() {
        var params = 'action=export&page_id=' + encodeURIComponent(state.pageId);
        if (state.accessToken) params += '&access_token=' + encodeURIComponent(state.accessToken);
        window.location.href = 'api/submissions.php?' + params;
    }

    // ----------------------------------------------------------------
    // UI helpers
    // ----------------------------------------------------------------
    function updatePageTitle() {
        var el = document.getElementById('rsvp-page-title');
        if (el) el.textContent = state.pageTitle || 'RSVP Dashboard';
        document.title = (state.pageTitle ? state.pageTitle + ' — ' : '') + 'RSVP Dashboard';
    }

    function updateFormStatusBadge() {
        var badge = document.getElementById('form-status-badge');
        if (badge) {
            badge.className = 'rsvp-form-status-badge ' + (state.formOpen ? 'open' : 'closed');
            badge.innerHTML = '<span class="rsvp-form-status-dot"></span>' + (state.formOpen ? 'Form open' : 'Form closed');
        }

        // Swap lock icon: open lock when form is open, closed lock when form is closed
        var btn = document.getElementById('rsvp-toggle-form-btn');
        if (btn) {
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
    // Columns
    // ----------------------------------------------------------------
    function getFormColumns() {
        var keys = [];
        state.submissions.forEach(function (s) {
            Object.keys(s.form_data || {}).forEach(function (k) {
                if (keys.indexOf(k) === -1) keys.push(k);
            });
        });
        return keys;
    }

    function formatColLabel(key) {
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
