/**
 * Admin Panel JavaScript
 * Handles tab switching, user search, filters, pagination, and user detail modal
 */

(function() {
    'use strict';

    const AdminPanel = {
        currentTab: 'dashboard',
        currentFilter: 'all',
        currentSearch: '',
        currentPage: 1,
        totalPages: 1,
        debounceTimer: null,

        init() {
            // Initialize search input
            const searchInput = document.getElementById('user-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.debouncedSearch(e.target.value);
                });
            }

            // Load users initially
            this.loadUsers();

            // Convert timestamps to relative times
            this.convertTimestamps();

            // Initialize charts
            this.initCharts();
        },

        switchTab(tabName) {
            this.currentTab = tabName;

            // Update tab buttons
            document.querySelectorAll('.admin-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.getElementById(`tab-${tabName}`).classList.add('active');

            // Update tab content
            document.querySelectorAll('.admin-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`content-${tabName}`).classList.add('active');

            // Load users if switching to users tab
            if (tabName === 'users') {
                this.loadUsers();
            }
        },

        debouncedSearch(searchTerm) {
            clearTimeout(this.debounceTimer);
            this.currentSearch = searchTerm;
            this.currentPage = 1; // Reset to page 1 on new search

            this.debounceTimer = setTimeout(() => {
                this.loadUsers();
            }, 300);
        },

        setFilter(filter) {
            this.currentFilter = filter;
            this.currentPage = 1; // Reset to page 1 on filter change

            // Update filter pills
            document.querySelectorAll('.filter-pill').forEach(pill => {
                pill.classList.remove('active');
            });
            document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

            this.loadUsers();
        },

        async loadUsers() {
            const tbody = document.getElementById('users-table-body');
            if (!tbody) return;

            // Show loading state
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-8 text-center text-sm text-gray-500">
                        Loading users...
                    </td>
                </tr>
            `;

            try {
                const params = new URLSearchParams({
                    action: 'users',
                    search: this.currentSearch,
                    filter: this.currentFilter,
                    page: this.currentPage
                });

                console.log('Admin - Loading users with params:', {
                    search: this.currentSearch,
                    filter: this.currentFilter,
                    page: this.currentPage
                });

                const response = await fetch(`./api/admin.php?${params}`);
                console.log('Admin - Response status:', response.status);

                const data = await response.json();
                console.log('Admin - Response data:', data);

                if (!data.success) {
                    throw new Error(data.message || data.error || 'Failed to load users');
                }

                this.totalPages = data.pagination.total_pages;
                this.renderUsers(data.users);
                this.updatePagination(data.pagination);

            } catch (error) {
                console.error('Error loading users:', error);
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-8 text-center text-sm text-red-500">
                            Error loading users: ${error.message}<br>
                            <span class="text-xs">Check browser console for details</span>
                        </td>
                    </tr>
                `;
            }
        },

        renderUsers(users) {
            const tbody = document.getElementById('users-table-body');
            if (!tbody) return;

            if (users.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-8 text-center text-sm text-gray-500">
                            No users found.
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = users.map(user => `
                <tr class="hover:bg-gray-50 cursor-pointer" onclick="AdminPanel.openUserDetail(${user.id})">
                    <td class="px-6 py-4 text-sm text-gray-900">${this.escapeHtml(user.email)}</td>
                    <td class="px-6 py-4 text-sm text-gray-900">${this.escapeHtml(user.name || '—')}</td>
                    <td class="px-6 py-4 text-sm">
                        ${user.is_pro
                            ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Pro</span>'
                            : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Free</span>'
                        }
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900">${user.pages_count}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${user.last_login ? this.formatRelativeTime(user.last_login) : 'Never'}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${this.formatRelativeTime(user.created_at)}</td>
                </tr>
            `).join('');
        },

        updatePagination(pagination) {
            const infoEl = document.getElementById('pagination-info');
            const prevBtn = document.getElementById('prev-page');
            const nextBtn = document.getElementById('next-page');

            if (!infoEl || !prevBtn || !nextBtn) return;

            const start = (pagination.page - 1) * pagination.per_page + 1;
            const end = Math.min(pagination.page * pagination.per_page, pagination.total);

            infoEl.textContent = `Showing ${start}-${end} of ${pagination.total}`;

            prevBtn.disabled = pagination.page <= 1;
            nextBtn.disabled = pagination.page >= pagination.total_pages;
        },

        prevPage() {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadUsers();
            }
        },

        nextPage() {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.loadUsers();
            }
        },

        async openUserDetail(userId) {
            const modal = document.getElementById('user-detail-modal');
            const content = document.getElementById('user-detail-content');
            if (!modal || !content) return;

            // Show modal with loading state
            modal.classList.remove('hidden');
            content.innerHTML = '<div class="text-center text-gray-500 py-8">Loading...</div>';

            try {
                const response = await fetch(`./api/admin.php?action=user-detail&user_id=${userId}`);
                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || 'Failed to load user details');
                }

                this.renderUserDetail(data.user, data.pages);

            } catch (error) {
                console.error('Error loading user details:', error);
                content.innerHTML = '<div class="text-center text-red-500 py-8">Error loading user details.</div>';
            }
        },

        renderUserDetail(user, pages) {
            const content = document.getElementById('user-detail-content');
            if (!content) return;

            content.innerHTML = `
                <div class="space-y-6">
                    <!-- User Info -->
                    <div class="grid grid-cols-2 gap-4 pb-6 border-b border-gray-200">
                        <div>
                            <div class="text-sm text-gray-500 mb-1">Email</div>
                            <div class="text-sm font-medium text-gray-900">${this.escapeHtml(user.email)}</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500 mb-1">Name</div>
                            <div class="text-sm font-medium text-gray-900">${this.escapeHtml(user.name || '—')}</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500 mb-1">Status</div>
                            <div class="text-sm font-medium">
                                ${user.is_pro
                                    ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Pro</span>'
                                    : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Free</span>'
                                }
                            </div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500 mb-1">Clerk User ID</div>
                            <div class="text-sm font-medium text-gray-900">${this.escapeHtml(user.clerk_user_id || '—')}</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500 mb-1">Last Login</div>
                            <div class="text-sm font-medium text-gray-900">${user.last_login ? this.formatRelativeTime(user.last_login) : 'Never'}</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500 mb-1">Joined</div>
                            <div class="text-sm font-medium text-gray-900">${this.formatRelativeTime(user.created_at)}</div>
                        </div>
                    </div>

                    <!-- User Pages -->
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-4">Pages (${pages.length})</h3>
                        ${pages.length === 0
                            ? '<div class="text-center text-gray-500 py-8">No pages created yet.</div>'
                            : `
                                <div class="space-y-3">
                                    ${pages.map(page => `
                                        <div class="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                                            <div class="flex gap-4">
                                                ${page.thumbnail_url
                                                    ? `<img src="${this.escapeHtml(page.thumbnail_url)}" alt="Page thumbnail" class="w-32 h-24 object-cover rounded-lg flex-shrink-0">`
                                                    : '<div class="w-32 h-24 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">No preview</div>'
                                                }
                                                <div class="flex-1 min-w-0">
                                                    <div class="text-sm font-medium text-gray-900 mb-2">${this.escapeHtml(page.title || 'Untitled')}</div>
                                                    <div class="flex flex-wrap gap-2 text-xs text-gray-500 mb-2">
                                                        <span class="inline-flex items-center px-2 py-0.5 rounded-full ${page.is_public ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}">
                                                            ${page.is_public ? 'Public' : 'Private'}
                                                        </span>
                                                        <span>ID: ${page.id}</span>
                                                        <span>Created: ${this.formatRelativeTime(page.created_at)}</span>
                                                        <span>Last accessed: ${page.last_accessed ? this.formatRelativeTime(page.last_accessed) : 'Never'}</span>
                                                    </div>
                                                    <a href="./view.php?page_id=${page.id}" target="_blank" class="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                                                        <span>View page</span>
                                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                                        </svg>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            `
                        }
                    </div>
                </div>
            `;
        },

        closeUserDetail() {
            const modal = document.getElementById('user-detail-modal');
            if (modal) {
                modal.classList.add('hidden');
            }
        },

        formatRelativeTime(dateString) {
            const date = new Date(dateString);
            const now = new Date();
            const diffInSeconds = Math.floor((now - date) / 1000);

            if (diffInSeconds < 60) return 'Just now';
            if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
            if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
            if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
            if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
            if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
            return `${Math.floor(diffInSeconds / 31536000)} years ago`;
        },

        convertTimestamps() {
            document.querySelectorAll('[data-timestamp]').forEach(el => {
                const timestamp = parseInt(el.getAttribute('data-timestamp'));
                if (!timestamp) return;

                const date = new Date(timestamp * 1000);
                el.textContent = this.formatRelativeTime(date.toISOString());
            });
        },

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        initCharts() {
            if (!window.adminChartData) {
                console.warn('Chart data not available');
                return;
            }

            const data = window.adminChartData;

            // Common chart options
            const commonOptions = {
                chart: {
                    fontFamily: 'inherit',
                    toolbar: {
                        show: false
                    },
                    zoom: {
                        enabled: false
                    }
                },
                dataLabels: {
                    enabled: false
                },
                stroke: {
                    curve: 'smooth',
                    width: 3
                },
                grid: {
                    borderColor: '#f1f5f9',
                    strokeDashArray: 4
                },
                tooltip: {
                    theme: 'light'
                }
            };

            // New Users Chart (Area)
            const newUsersChart = new ApexCharts(document.querySelector('#chart-new-users'), {
                ...commonOptions,
                series: [{
                    name: 'New Users',
                    data: data.newUsers.map(d => d.count)
                }],
                chart: {
                    ...commonOptions.chart,
                    type: 'area',
                    height: 280
                },
                xaxis: {
                    categories: data.newUsers.map(d => {
                        const date = new Date(d.date);
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }),
                    labels: {
                        style: {
                            colors: '#9ca3af',
                            fontSize: '12px'
                        }
                    }
                },
                yaxis: {
                    labels: {
                        style: {
                            colors: '#9ca3af',
                            fontSize: '12px'
                        }
                    }
                },
                fill: {
                    type: 'gradient',
                    gradient: {
                        shadeIntensity: 1,
                        opacityFrom: 0.4,
                        opacityTo: 0.1,
                        stops: [0, 90, 100]
                    }
                },
                colors: ['#3b82f6']
            });
            newUsersChart.render();

            // Pages Created Chart (Bar)
            const pagesChart = new ApexCharts(document.querySelector('#chart-pages-created'), {
                ...commonOptions,
                series: [{
                    name: 'Pages Created',
                    data: data.pagesCreated.map(d => d.count)
                }],
                chart: {
                    ...commonOptions.chart,
                    type: 'bar',
                    height: 280
                },
                plotOptions: {
                    bar: {
                        borderRadius: 6,
                        columnWidth: '60%'
                    }
                },
                xaxis: {
                    categories: data.pagesCreated.map(d => {
                        const date = new Date(d.date);
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }),
                    labels: {
                        style: {
                            colors: '#9ca3af',
                            fontSize: '12px'
                        }
                    }
                },
                yaxis: {
                    labels: {
                        style: {
                            colors: '#9ca3af',
                            fontSize: '12px'
                        }
                    }
                },
                colors: ['#2563eb']
            });
            pagesChart.render();

            // User Breakdown Chart (Donut)
            const breakdownChart = new ApexCharts(document.querySelector('#chart-user-breakdown'), {
                series: [data.userBreakdown.free, data.userBreakdown.paid],
                chart: {
                    type: 'donut',
                    height: 280,
                    fontFamily: 'inherit'
                },
                labels: ['Free Users', 'Paid Users'],
                colors: ['#94a3b8', '#10b981'],
                legend: {
                    position: 'bottom',
                    fontSize: '14px',
                    labels: {
                        colors: '#6b7280'
                    }
                },
                plotOptions: {
                    pie: {
                        donut: {
                            size: '70%',
                            labels: {
                                show: true,
                                total: {
                                    show: true,
                                    label: 'Total Users',
                                    fontSize: '16px',
                                    color: '#6b7280',
                                    formatter: function (w) {
                                        return w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                    }
                                }
                            }
                        }
                    }
                },
                dataLabels: {
                    enabled: true,
                    style: {
                        fontSize: '14px'
                    }
                },
                tooltip: {
                    theme: 'light'
                }
            });
            breakdownChart.render();

            // Active Users Chart (Line)
            const activeUsersChart = new ApexCharts(document.querySelector('#chart-active-users'), {
                ...commonOptions,
                series: [{
                    name: 'Active Users',
                    data: data.activeUsers.map(d => d.count)
                }],
                chart: {
                    ...commonOptions.chart,
                    type: 'line',
                    height: 280
                },
                xaxis: {
                    categories: data.activeUsers.map(d => {
                        const date = new Date(d.date);
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }),
                    labels: {
                        style: {
                            colors: '#9ca3af',
                            fontSize: '12px'
                        }
                    }
                },
                yaxis: {
                    labels: {
                        style: {
                            colors: '#9ca3af',
                            fontSize: '12px'
                        }
                    }
                },
                markers: {
                    size: 4,
                    colors: ['#8b5cf6'],
                    strokeColors: '#fff',
                    strokeWidth: 2,
                    hover: {
                        size: 6
                    }
                },
                colors: ['#8b5cf6']
            });
            activeUsersChart.render();
        },

        filterByProStatus(status) {
            this.switchTab('users');
            setTimeout(() => {
                this.setFilter(status);
            }, 100);
        },

        showPagesDetail() {
            alert('Pages detail view coming soon!\n\nThis will show:\n- Pages created over time\n- Most active pages\n- Public vs private breakdown');
        },

        showActive7dDetail() {
            this.switchTab('users');
            setTimeout(() => {
                // Filter users active in last 7 days
                this.currentSearch = '';
                this.currentFilter = 'all';
                document.getElementById('user-search').value = '';
                this.loadUsers();
                // In a full implementation, you'd add a date filter to the API
            }, 100);
        },

        showActive30dDetail() {
            this.switchTab('users');
            setTimeout(() => {
                // Filter users active in last 30 days
                this.currentSearch = '';
                this.currentFilter = 'all';
                document.getElementById('user-search').value = '';
                this.loadUsers();
                // In a full implementation, you'd add a date filter to the API
            }, 100);
        }
    };

    // Expose to global scope
    window.AdminPanel = AdminPanel;

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => AdminPanel.init());
    } else {
        AdminPanel.init();
    }

    // Close modal on background click
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('user-detail-modal');
        if (modal && e.target === modal) {
            AdminPanel.closeUserDetail();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            AdminPanel.closeUserDetail();
        }
    });
})();
