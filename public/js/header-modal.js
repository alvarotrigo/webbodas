/**
 * Header Panel - sidebar panel for adding/customizing a header nav
 * Step 1: Pick a layout (4 options)
 * Step 2: Customize with Essentials + Advanced controls
 */
(function() {
    'use strict';

    // ============================================
    // STATE
    // ============================================
    let headerState = {
        layoutId: null,
        config: {
            background: 'solid',
            corners: 'rounded',
            theme: 'light',
            shadow: 'none',
            ctaType: '2-buttons',
            ctaStyle: 'auto'
        },
        content: {
            logo: { type: 'text', text: 'Brand', src: '' },
            menu: [
                { label: 'Home', href: '#' },
                { label: 'About', href: '#' },
                { label: 'Team', href: '#' },
                { label: 'Blog', href: '#' }
            ],
            actions: [
                { label: 'Sign in', href: '#' },
                { label: 'Get Started', href: '#' }
            ]
        },
        headerInserted: false
    };

    const CLASS_PREFIXES = {
        background: 'nav-bg-',
        corners: 'nav-corners-',
        theme: 'nav-theme-',
        shadow: 'nav-shadow-'
    };

    // ============================================
    // HTML ESCAPING UTILITIES
    // ============================================
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeAttr(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ============================================
    // CONTENT FRAGMENT GENERATORS
    // ============================================
    function buildLogoHtml(content) {
        const { type, text, src } = content.logo;
        const logoText = text || 'Brand';
        const firstLetter = logoText.charAt(0).toUpperCase();

        if (type === 'image' && src) {
            return `<div class="flex items-center gap-2" data-header-zone="logo">
              <img src="${escapeAttr(src)}" alt="${escapeAttr(logoText)}" class="w-10 h-10 object-contain" />
              <span class="font-bold text-xl" style="color: var(--accent-text);">${escapeHtml(logoText)}</span>
            </div>`;
        } else {
            return `<div class="flex items-center gap-2" data-header-zone="logo">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" class="w-10 h-10">
                <rect width="40" height="40" rx="8" fill="var(--secondary-accent)"/>
                <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="var(--primary-bg)" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600">${escapeHtml(firstLetter)}</text>
              </svg>
              <span class="font-bold text-xl" style="color: var(--accent-text);">${escapeHtml(logoText)}</span>
            </div>`;
        }
    }

    function buildNavLinksHtml(menu) {
        return menu.map(item =>
            `<a href="${escapeAttr(item.href)}" class="font-medium hover:opacity-70 transition-opacity" style="color: var(--primary-text);">${escapeHtml(item.label)}</a>`
        ).join('\n            ');
    }

    function buildDesktopActionsHtml(actions, ctaType) {
        if (ctaType === 'none') {
            return '';
        }

        if (ctaType === 'icons') {
            return `<div class="hidden md:flex items-center gap-4" data-nav-icons data-header-zone="actions">
              <svg class="w-6 h-6 cursor-pointer hover:opacity-70" style="color: var(--primary-text);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <svg class="w-6 h-6 cursor-pointer hover:opacity-70" style="color: var(--primary-text);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              <svg class="w-6 h-6 cursor-pointer hover:opacity-70" style="color: var(--primary-text);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
              <svg class="w-6 h-6 cursor-pointer hover:opacity-70" style="color: var(--primary-text);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
            </div>`;
        }

        // Button type (2-buttons or button)
        const button1 = actions[0] || { label: 'Sign in', href: '#' };
        const button2 = actions[1] || { label: 'Get Started', href: '#' };

        if (ctaType === '2-buttons') {
            return `<div class="hidden md:flex items-center gap-3" data-nav-buttons data-header-zone="actions">
              <a href="${escapeAttr(button1.href)}" class="px-4 py-2 font-medium border transition-all hover:opacity-80" style="border-radius: var(--button-radius); color: var(--primary-text); border-color: var(--secondary-text);" data-cta="true" data-cta-1>${escapeHtml(button1.label)}</a>
              <a href="${escapeAttr(button2.href)}" class="px-5 py-2 font-medium transition-all hover:opacity-90" style="background: var(--secondary-accent); border-radius: var(--button-radius); color: var(--primary-text);" data-cta="true" data-cta-2>${escapeHtml(button2.label)}</a>
            </div>`;
        } else if (ctaType === 'button') {
            return `<div class="hidden md:flex items-center gap-3" data-nav-buttons data-header-zone="actions">
              <a href="${escapeAttr(button2.href)}" class="px-5 py-2 font-medium transition-all hover:opacity-90" style="background: var(--secondary-accent); border-radius: var(--button-radius); color: var(--primary-text);" data-cta="true" data-cta-2>${escapeHtml(button2.label)}</a>
            </div>`;
        }

        return '';
    }

    function buildMobileMenuHtml(layoutId, menu, actions) {
        const menuId = `header-menu-${layoutId}`;
        const menuLinks = menu.map(item =>
            `<a href="${escapeAttr(item.href)}" class="py-2 font-medium" style="color: var(--primary-text);">${escapeHtml(item.label)}</a>`
        ).join('\n            ');

        const button1 = actions[0] || { label: 'Sign in', href: '#' };
        const button2 = actions[1] || { label: 'Get Started', href: '#' };

        // Layout 4 (Minimal) has no menu links
        if (layoutId === 4) {
            return `<div id="${menuId}" class="mobile-menu md:hidden">
          <div class="pt-4 pb-2 flex flex-col gap-3">
            <a href="${escapeAttr(button1.href)}" class="mt-2 px-4 py-2 font-medium border transition-all hover:opacity-80" style="border-radius: var(--button-radius); color: var(--primary-text); border-color: var(--secondary-text);">${escapeHtml(button1.label)}</a>
            <a href="${escapeAttr(button2.href)}" class="px-5 py-2 font-medium transition-all hover:opacity-90" style="border-radius: var(--button-radius); background: var(--secondary-accent); color: var(--primary-text);">${escapeHtml(button2.label)}</a>
          </div>
        </div>`;
        }

        return `<div id="${menuId}" class="mobile-menu md:hidden">
          <div class="pt-4 pb-2 flex flex-col gap-3">
            ${menuLinks}
            <a href="${escapeAttr(button1.href)}" class="mt-2 px-4 py-2 font-medium border transition-all hover:opacity-80" style="border-radius: var(--button-radius); color: var(--primary-text); border-color: var(--secondary-text);">${escapeHtml(button1.label)}</a>
            <a href="${escapeAttr(button2.href)}" class="px-5 py-2 font-medium transition-all hover:opacity-90" style="border-radius: var(--button-radius); background: var(--secondary-accent); color: var(--primary-text);">${escapeHtml(button2.label)}</a>
          </div>
        </div>`;
    }

    // ============================================
    // LAYOUT ASSEMBLERS
    // ============================================
    function buildLayout1(content, config) {
        const logo = buildLogoHtml(content);
        const navLinks = buildNavLinksHtml(content.menu);
        const actions = buildDesktopActionsHtml(content.actions, config.ctaType);
        const mobileMenu = buildMobileMenuHtml(1, content.menu, content.actions);

        return `<nav class="nav-bg-solid nav-corners-rounded nav-theme-light nav-shadow-none px-6 py-4">
      <div class="nav-content-wrapper">
        <div class="flex items-center justify-between">
          ${logo}
          <div class="hidden md:flex items-center gap-8" data-header-zone="menu">
            ${navLinks}
          </div>
          ${actions}
          <button class="md:hidden p-2" onclick="window.toggleHeaderMenu && window.toggleHeaderMenu('header-menu-1')" style="color: var(--primary-text);">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
        </div>
        ${mobileMenu}
      </div>
    </nav>`;
    }

    function buildLayout2(content, config) {
        const logo = buildLogoHtml(content);
        const leftLinks = content.menu.slice(0, 2);
        const rightLinks = content.menu.slice(2, 4);
        const leftHtml = buildNavLinksHtml(leftLinks);
        const rightHtml = buildNavLinksHtml(rightLinks);
        const actions = buildDesktopActionsHtml(content.actions, config.ctaType);
        const mobileMenu = buildMobileMenuHtml(2, content.menu, content.actions);

        return `<nav class="nav-bg-solid nav-corners-rounded nav-theme-light nav-shadow-none px-6 py-4">
      <div class="nav-content-wrapper">
        <div class="flex items-center justify-between">
          <div class="hidden md:flex items-center gap-8" data-header-zone="menu">
            ${leftHtml}
          </div>
          ${logo}
          <div class="hidden md:flex items-center gap-3">
            <div class="flex items-center gap-8" data-header-zone="menu">
              ${rightHtml}
            </div>
            ${actions}
          </div>
          <button class="md:hidden p-2" onclick="window.toggleHeaderMenu && window.toggleHeaderMenu('header-menu-2')" style="color: var(--primary-text);">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
        </div>
        ${mobileMenu}
      </div>
    </nav>`;
    }

    function buildLayout4(content, config) {
        const logo = buildLogoHtml(content);
        const actions = buildDesktopActionsHtml(content.actions, config.ctaType);
        const mobileMenu = buildMobileMenuHtml(4, content.menu, content.actions);

        return `<nav class="nav-bg-solid nav-corners-rounded nav-theme-light nav-shadow-none px-6 py-4">
      <div class="nav-content-wrapper">
        <div class="flex items-center justify-between">
          ${logo}
          <div class="flex items-center gap-3">
            ${actions}
            <button class="md:hidden p-2" onclick="window.toggleHeaderMenu && window.toggleHeaderMenu('header-menu-4')" style="color: var(--primary-text);">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
          </div>
        </div>
        ${mobileMenu}
      </div>
    </nav>`;
    }

    function buildLayout5(content, config) {
        const logo = buildLogoHtml(content);
        const navLinks = buildNavLinksHtml(content.menu);
        const actions = buildDesktopActionsHtml(content.actions, config.ctaType);
        const mobileMenu = buildMobileMenuHtml(5, content.menu, content.actions);

        return `<nav class="nav-bg-solid nav-corners-rounded nav-theme-light nav-shadow-none px-6 py-4">
      <div class="nav-content-wrapper">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-8">
            ${logo}
            <div class="hidden md:flex items-center gap-6" data-header-zone="menu">
              ${navLinks}
            </div>
          </div>
          <div class="hidden md:flex items-center gap-3">
            ${actions}
          </div>
          <button class="md:hidden p-2" onclick="window.toggleHeaderMenu && window.toggleHeaderMenu('header-menu-5')" style="color: var(--primary-text);">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
        </div>
        ${mobileMenu}
      </div>
    </nav>`;
    }

    // ============================================
    // LAYOUT TEMPLATES
    // ============================================
    const HEADER_LAYOUTS = {
        1: { name: 'Standard', desc: 'Logo + Nav + Actions' },
        2: { name: 'Centered', desc: 'Centered Logo' },
        4: { name: 'Minimal', desc: 'Logo + Actions Only' },
        5: { name: 'Split', desc: 'Logo + Nav grouped left' }
    };

    function getLayoutHtml(layoutId) {
        const assemblers = {
            1: buildLayout1,
            2: buildLayout2,
            4: buildLayout4,
            5: buildLayout5
        };

        const assembler = assemblers[layoutId];
        if (!assembler) return '';

        try {
            return assembler(headerState.content, headerState.config);
        } catch (error) {
            console.error('[Header] Error in assembler for layout', layoutId, ':', error);
            // Fallback to simple template
            return `<nav class="nav-bg-solid nav-corners-rounded nav-theme-light nav-shadow-none px-6 py-4">
                <div class="nav-content-wrapper">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" class="w-10 h-10">
                                <rect width="40" height="40" rx="8" fill="var(--secondary-accent)"/>
                                <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="var(--primary-bg)" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600">B</text>
                            </svg>
                            <span class="font-bold text-xl" style="color: var(--accent-text);">Brand</span>
                        </div>
                        <div class="hidden md:flex items-center gap-8">
                            <a href="#" class="font-medium hover:opacity-70 transition-opacity" style="color: var(--primary-text);">Home</a>
                            <a href="#" class="font-medium hover:opacity-70 transition-opacity" style="color: var(--primary-text);">About</a>
                            <a href="#" class="font-medium hover:opacity-70 transition-opacity" style="color: var(--primary-text);">Team</a>
                            <a href="#" class="font-medium hover:opacity-70 transition-opacity" style="color: var(--primary-text);">Blog</a>
                        </div>
                        <div class="hidden md:flex items-center gap-3" data-nav-buttons>
                            <a href="#" class="px-4 py-2 font-medium border transition-all hover:opacity-80" style="border-radius: var(--button-radius); color: var(--primary-text); border-color: var(--secondary-text);" data-cta="true" data-cta-1>Sign in</a>
                            <a href="#" class="px-5 py-2 font-medium transition-all hover:opacity-90" style="background: var(--secondary-accent); border-radius: var(--button-radius); color: var(--primary-text);" data-cta="true" data-cta-2>Get Started</a>
                        </div>
                        <button class="md:hidden p-2" onclick="window.toggleHeaderMenu && window.toggleHeaderMenu('header-menu-1')" style="color: var(--primary-text);">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                        </button>
                    </div>
                </div>
            </nav>`;
        }
    }

    // ============================================
    // DOM HELPERS
    // ============================================
    function getIframe() {
        return document.getElementById('preview-iframe');
    }

    function postToIframe(type, data) {
        const iframe = getIframe();
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type, data }, '*');
        }
    }

    function addCommandToHistory(command) {
        if (!window.historyManager) return;

        // Add command to stack without executing (we already applied the change)
        if (window.historyManager.commandIndex < window.historyManager.commandStack.length - 1) {
            window.historyManager.commandStack = window.historyManager.commandStack.slice(0, window.historyManager.commandIndex + 1);
        }
        window.historyManager.commandStack.push(command);
        window.historyManager.commandIndex = window.historyManager.commandStack.length - 1;
        window.historyManager.updateButtons();

        if (typeof window.scheduleAutosave === 'function') {
            window.scheduleAutosave();
        }
    }

    function removeClassesWithPrefix(element, prefix) {
        Array.from(element.classList)
            .filter(cls => cls.startsWith(prefix))
            .forEach(cls => element.classList.remove(cls));
    }

    // ============================================
    // CORE FUNCTIONS
    // ============================================

    function openPanel() {
        const panel = document.getElementById('header-panel');
        if (!panel) return;

        // Close other panels that might be open (theme, category)
        const themePanel = document.getElementById('theme-panel');
        if (themePanel) themePanel.classList.remove('show');
        const categoryPanel = document.getElementById('category-hover-panel');
        if (categoryPanel) categoryPanel.classList.remove('show');

        // Hide sidebar and push main area + top bar
        const sidebar = document.querySelector('.sidebar');
        const mainArea = document.querySelector('.main-area');
        const topBar = document.querySelector('.top-bar');
        const sidebarToggle = document.querySelector('.sidebar-toggle');

        if (sidebar) sidebar.classList.add('header-panel-open');
        if (mainArea) mainArea.classList.add('header-panel-open');
        if (topBar) topBar.classList.add('header-panel-open');
        if (sidebarToggle) sidebarToggle.classList.add('header-panel-open');

        panel.classList.add('show');

        // If a layout is already selected, go to step 2
        if (headerState.layoutId) {
            showStep(2);
        } else {
            showStep(1);
        }
    }

    function closePanel() {
        const panel = document.getElementById('header-panel');
        if (panel) panel.classList.remove('show');

        // Restore sidebar and main area + top bar
        const sidebar = document.querySelector('.sidebar');
        const mainArea = document.querySelector('.main-area');
        const topBar = document.querySelector('.top-bar');
        const sidebarToggle = document.querySelector('.sidebar-toggle');

        if (sidebar) sidebar.classList.remove('header-panel-open');
        if (mainArea) mainArea.classList.remove('header-panel-open');
        if (topBar) topBar.classList.remove('header-panel-open');
        if (sidebarToggle) sidebarToggle.classList.remove('header-panel-open');
    }

    function showStep(step) {
        const step1 = document.getElementById('header-step-1');
        const step2 = document.getElementById('header-step-2');
        const title = document.getElementById('header-panel-title-text');
        const backBtn = document.getElementById('header-panel-back');
        const navIcon = document.getElementById('header-panel-icon');

        if (step === 1) {
            if (step1) step1.style.display = 'block';
            if (step2) step2.style.display = 'none';
            if (title) title.textContent = 'Header';
            if (backBtn) backBtn.style.display = 'none';
            if (navIcon) navIcon.style.display = '';
            highlightSelectedLayout();
        } else {
            if (step1) step1.style.display = 'none';
            if (step2) step2.style.display = 'block';
            if (title) title.textContent = 'Customize Header';
            // No back button in step 2 anymore
            if (backBtn) backBtn.style.display = 'none';
            if (navIcon) navIcon.style.display = 'none';
            syncControlsToState();
            updateConditionalVisibility();
            highlightMiniLayout();
        }
    }

    function highlightSelectedLayout() {
        document.querySelectorAll('.header-layout-item').forEach(item => {
            const id = parseInt(item.getAttribute('data-layout'));
            const card = item.querySelector('.header-layout-card');
            if (card) card.classList.toggle('selected', id === headerState.layoutId);
        });
    }

    function highlightMiniLayout() {
        document.querySelectorAll('[data-layout-switch]').forEach(btn => {
            const id = parseInt(btn.getAttribute('data-layout-switch'));
            btn.classList.toggle('active', id === headerState.layoutId);
        });
    }

    function selectLayout(layoutId, skipUndo = false) {
        // Capture before state for undo
        const beforeState = !skipUndo ? JSON.parse(JSON.stringify(headerState)) : null;

        headerState.layoutId = layoutId;
        headerState.headerInserted = true;

        // Build nav HTML with current config classes
        const html = buildNavHtml(layoutId);

        // Send to iframe
        postToIframe('SET_HEADER', {
            html: html
        });

        // Apply CTA settings after a short delay for DOM readiness
        setTimeout(() => {
            postToIframe('UPDATE_HEADER_CTA', {
                ctaType: headerState.config.ctaType,
                ctaStyle: headerState.config.ctaStyle
            });
        }, 50);

        // Advance to step 2
        showStep(2);
        updateSidebarButton();

        // Create undo command
        if (!skipUndo && beforeState && window.historyManager && window.HeaderChangeCommand) {
            const afterState = JSON.parse(JSON.stringify(headerState));

            // Determine if this is a layout change or initial add
            const action = beforeState.layoutId ? 'layout-change' : 'add';

            const command = new window.HeaderChangeCommand({
                beforeState: beforeState,
                afterState: afterState,
                context: { action }
            });

            addCommandToHistory(command);
        }
    }

    function buildNavHtml(layoutId) {
        const template = getLayoutHtml(layoutId);

        // Parse and apply current config classes
        const temp = document.createElement('div');
        temp.innerHTML = template;
        const nav = temp.querySelector('nav');
        if (!nav) return template;

        // Remove default classes and apply current config
        Object.keys(CLASS_PREFIXES).forEach(key => {
            removeClassesWithPrefix(nav, CLASS_PREFIXES[key]);
            nav.classList.add(CLASS_PREFIXES[key] + headerState.config[key]);
        });

        return nav.outerHTML;
    }

    function updateHeaderContent() {
        if (!headerState.layoutId || !headerState.headerInserted) return;

        // Rebuild HTML from current state
        const html = buildNavHtml(headerState.layoutId);

        // Send to iframe
        postToIframe('SET_HEADER', { html });

        // Re-apply CTA settings
        setTimeout(() => {
            postToIframe('UPDATE_HEADER_CTA', {
                ctaType: headerState.config.ctaType,
                ctaStyle: headerState.config.ctaStyle
            });
        }, 50);
    }

    function applyOption(type, value, skipUndo = false) {
        // Capture before state
        const beforeState = !skipUndo ? JSON.parse(JSON.stringify(headerState)) : null;

        headerState.config[type] = value;

        const prefix = CLASS_PREFIXES[type];
        if (prefix) {
            postToIframe('UPDATE_HEADER_CLASSES', {
                prefix: prefix,
                value: prefix + value
            });
        }

        // Create undo command
        if (!skipUndo && beforeState && window.historyManager && window.HeaderChangeCommand) {
            const afterState = JSON.parse(JSON.stringify(headerState));
            const command = new window.HeaderChangeCommand({
                beforeState: beforeState,
                afterState: afterState,
                context: { action: 'style-change' }
            });
            addCommandToHistory(command);
        }
    }

    function applyCtaType(value, skipUndo = false) {
        // Capture before state
        const beforeState = !skipUndo ? JSON.parse(JSON.stringify(headerState)) : null;

        headerState.config.ctaType = value;
        postToIframe('UPDATE_HEADER_CTA', {
            ctaType: value,
            ctaStyle: headerState.config.ctaStyle
        });
        updateConditionalVisibility();

        // Create undo command
        if (!skipUndo && beforeState && window.historyManager && window.HeaderChangeCommand) {
            const afterState = JSON.parse(JSON.stringify(headerState));
            const command = new window.HeaderChangeCommand({
                beforeState: beforeState,
                afterState: afterState,
                context: { action: 'style-change' }
            });
            addCommandToHistory(command);
        }
    }

    function applyCtaStyle(value, skipUndo = false) {
        // Capture before state
        const beforeState = !skipUndo ? JSON.parse(JSON.stringify(headerState)) : null;

        headerState.config.ctaStyle = value;
        postToIframe('UPDATE_HEADER_CTA', {
            ctaType: headerState.config.ctaType,
            ctaStyle: value
        });

        // Create undo command
        if (!skipUndo && beforeState && window.historyManager && window.HeaderChangeCommand) {
            const afterState = JSON.parse(JSON.stringify(headerState));
            const command = new window.HeaderChangeCommand({
                beforeState: beforeState,
                afterState: afterState,
                context: { action: 'style-change' }
            });
            addCommandToHistory(command);
        }
    }

    function updateConditionalVisibility() {
        const actionsGroup = document.getElementById('header-cta-type-group');
        const ctaStyleGroup = document.getElementById('header-cta-style-group');
        const ctaType = headerState.config.ctaType;

        // Actions group is always visible for current layouts
        if (actionsGroup) actionsGroup.style.display = '';

        // CTA Style group only visible when buttons are showing
        if (ctaStyleGroup) {
            if (ctaType === 'none' || ctaType === 'icons') {
                ctaStyleGroup.style.display = 'none';
            } else {
                ctaStyleGroup.style.display = '';
            }
        }
    }

    function syncControlsToState() {
        const cfg = headerState.config;
        syncActiveButton('background', cfg.background);
        syncActiveButton('corners', cfg.corners);
        syncActiveButton('theme', cfg.theme);
        syncActiveButton('shadow', cfg.shadow);
        syncActiveButton('cta-type', cfg.ctaType);
        syncActiveButton('cta-style', cfg.ctaStyle);
    }

    function syncActiveButton(group, value) {
        document.querySelectorAll(`[data-header-group="${group}"]`).forEach(btn => {
            btn.classList.toggle('active', btn.dataset.headerValue === value);
        });
    }

    function updateSidebarButton() {
        const nameEl = document.getElementById('current-header-name');
        if (!nameEl) return;

        if (headerState.layoutId && headerState.headerInserted) {
            const layout = HEADER_LAYOUTS[headerState.layoutId];
            nameEl.textContent = layout ? layout.name : 'Header';
        } else {
            nameEl.textContent = 'Add Header';
        }
    }

    function removeHeader(skipUndo = false) {
        // Capture before state
        const beforeState = !skipUndo ? JSON.parse(JSON.stringify(headerState)) : null;

        postToIframe('REMOVE_HEADER', {});
        headerState.layoutId = null;
        headerState.headerInserted = false;
        updateSidebarButton();

        // Create undo command
        if (!skipUndo && beforeState && window.historyManager && window.HeaderChangeCommand) {
            const afterState = JSON.parse(JSON.stringify(headerState));
            const command = new window.HeaderChangeCommand({
                beforeState: beforeState,
                afterState: afterState,
                context: { action: 'remove' }
            });
            addCommandToHistory(command);
        }

        // Close panel after removing header
        closePanel();
    }

    // ============================================
    // SUB-PANEL NAVIGATION
    // ============================================
    let subPanelBeforeState = null;

    function showSubPanel(name) {
        // Capture before state for undo
        subPanelBeforeState = JSON.parse(JSON.stringify(headerState));

        // Hide step 2 main view
        const step2 = document.getElementById('header-step-2');
        if (step2) step2.style.display = 'none';

        // Show the requested sub-panel
        const panel = document.getElementById(`header-sub-${name}`);
        if (panel) {
            panel.style.display = 'block';

            // Populate sub-panel with current content
            if (name === 'logo') {
                populateLogoPanel();
            } else if (name === 'menu') {
                renderMenuList();
            } else if (name === 'actions') {
                renderActionsList();
            }
        }

        // Update title
        const titleEl = document.getElementById('header-panel-title-text');
        if (titleEl) {
            if (name === 'logo') titleEl.textContent = 'Edit Logo';
            else if (name === 'menu') titleEl.textContent = 'Edit Menu';
            else if (name === 'actions') titleEl.textContent = 'Edit Actions';
        }
    }

    function closeSubPanel() {
        // Determine which sub-panel was open
        let action = 'edit-content';
        const logoPanel = document.getElementById('header-sub-logo');
        const menuPanel = document.getElementById('header-sub-menu');
        const actionsPanel = document.getElementById('header-sub-actions');

        if (logoPanel && logoPanel.style.display !== 'none') action = 'edit-logo';
        else if (menuPanel && menuPanel.style.display !== 'none') action = 'edit-menu';
        else if (actionsPanel && actionsPanel.style.display !== 'none') action = 'edit-actions';

        // Hide all sub-panels
        document.querySelectorAll('.header-sub-panel').forEach(panel => {
            panel.style.display = 'none';
        });

        // Show step 2 main view
        const step2 = document.getElementById('header-step-2');
        if (step2) step2.style.display = 'block';

        // Restore title
        const titleEl = document.getElementById('header-panel-title-text');
        if (titleEl) titleEl.textContent = 'Customize Header';

        // Create undo command if content changed
        if (subPanelBeforeState && window.historyManager && window.HeaderChangeCommand) {
            const afterState = JSON.parse(JSON.stringify(headerState));

            // Only create command if state actually changed
            if (JSON.stringify(subPanelBeforeState) !== JSON.stringify(afterState)) {
                const command = new window.HeaderChangeCommand({
                    beforeState: subPanelBeforeState,
                    afterState: afterState,
                    context: { action }
                });
                addCommandToHistory(command);
            }
        }

        subPanelBeforeState = null;
    }

    // ============================================
    // LOGO EDITING
    // ============================================
    function populateLogoPanel() {
        const { type, text, src } = headerState.content.logo;

        // Set type toggle
        const textBtn = document.getElementById('logo-type-text');
        const imageBtn = document.getElementById('logo-type-image');
        if (textBtn && imageBtn) {
            textBtn.classList.toggle('active', type === 'text');
            imageBtn.classList.toggle('active', type === 'image');
        }

        // Set text input
        const textInput = document.getElementById('logo-text-input');
        if (textInput) textInput.value = text || 'Brand';

        // Show/hide groups based on type
        toggleLogoGroups(type);

        // Set image preview if exists
        if (type === 'image' && src) {
            const preview = document.getElementById('logo-image-preview');
            const placeholder = document.getElementById('logo-upload-placeholder');
            if (preview && placeholder) {
                preview.src = src;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
            }
        }
    }

    function toggleLogoGroups(type) {
        const textGroup = document.getElementById('logo-text-group');
        const imageGroup = document.getElementById('logo-image-group');
        if (textGroup) textGroup.style.display = type === 'text' ? 'block' : 'none';
        if (imageGroup) imageGroup.style.display = type === 'image' ? 'block' : 'none';
    }

    let logoTextDebounce = null;
    function updateLogoText(text) {
        clearTimeout(logoTextDebounce);
        logoTextDebounce = setTimeout(() => {
            headerState.content.logo.text = text;
            updateHeaderContent();
        }, 300);
    }

    function setLogoType(type) {
        headerState.content.logo.type = type;
        toggleLogoGroups(type);
        updateHeaderContent();
    }

    function openLogoUpload() {
        // Check if cloudinary is loaded
        if (typeof cloudinary === 'undefined') {
            console.error('Cloudinary widget not loaded');
            alert('Upload widget is still loading. Please try again in a moment.');
            return;
        }

        const uploadWidget = cloudinary.createUploadWidget({
            cloudName: 'devdwphku',
            uploadPreset: 'fp_studio',
            sources: ['local', 'url'],
            multiple: false,
            cropping: true,
            croppingAspectRatio: 1,
            croppingShowDimensions: true,
            resourceType: 'image',
            clientAllowedFormats: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'],
            maxFileSize: 5000000, // 5MB
            folder: 'logos',
            styles: {
                palette: {
                    window: '#FFFFFF',
                    windowBorder: '#E5E7EB',
                    tabIcon: '#4285F4',
                    menuIcons: '#4285F4',
                    textDark: '#000000',
                    textLight: '#FFFFFF',
                    link: '#4285F4',
                    action: '#4285F4',
                    inactiveTabIcon: '#9CA3AF',
                    error: '#EF4444',
                    inProgress: '#4285F4',
                    complete: '#10B981',
                    sourceBg: '#F9FAFB'
                }
            }
        }, (error, result) => {
            if (error) {
                console.error('Upload error:', error);
                return;
            }

            if (result && result.event === 'success') {
                const imageUrl = result.info.secure_url;

                // Update state
                headerState.content.logo.type = 'image';
                headerState.content.logo.src = imageUrl;

                // Update preview in panel
                const preview = document.getElementById('logo-image-preview');
                const placeholder = document.getElementById('logo-upload-placeholder');
                if (preview && placeholder) {
                    preview.src = imageUrl;
                    preview.style.display = 'block';
                    placeholder.style.display = 'none';
                }

                // Update header in iframe
                updateHeaderContent();

                // Sync type toggle buttons
                const textBtn = document.getElementById('logo-type-text');
                const imageBtn = document.getElementById('logo-type-image');
                if (textBtn && imageBtn) {
                    textBtn.classList.remove('active');
                    imageBtn.classList.add('active');
                }

                // Show image group
                toggleLogoGroups('image');
            }
        });

        uploadWidget.open();
    }

    // ============================================
    // MENU EDITING
    // ============================================
    function renderMenuList() {
        const container = document.getElementById('menu-items-container');
        if (!container) return;

        const menu = headerState.content.menu;

        // Check if layout 4 (Minimal) - hide menu editing
        if (headerState.layoutId === 4) {
            container.innerHTML = `
                <div class="header-content-note">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    <span>The Minimal layout does not display menu links.</span>
                </div>
            `;
            const addBtn = document.getElementById('add-menu-item-btn');
            if (addBtn) addBtn.style.display = 'none';
            return;
        }

        const addBtn = document.getElementById('add-menu-item-btn');
        if (addBtn) addBtn.style.display = menu.length >= 6 ? 'none' : 'flex';

        container.innerHTML = menu.map((item, index) => `
            <div class="header-menu-item-row" data-menu-index="${index}">
                <div class="header-menu-item-inputs">
                    <input type="text" class="header-input-field menu-label-input" placeholder="Label" value="${escapeAttr(item.label)}" data-index="${index}" maxlength="30">
                    <input type="text" class="header-input-field menu-url-input" placeholder="URL" value="${escapeAttr(item.href)}" data-index="${index}">
                </div>
                <button class="header-item-delete-btn menu-delete-btn" data-index="${index}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>
        `).join('');

        // Bind events
        bindMenuInputs();
    }

    let menuDebounceTimers = {};
    function bindMenuInputs() {
        // Label inputs
        document.querySelectorAll('.menu-label-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                clearTimeout(menuDebounceTimers[`label-${index}`]);
                menuDebounceTimers[`label-${index}`] = setTimeout(() => {
                    headerState.content.menu[index].label = e.target.value;
                    updateHeaderContent();
                }, 300);
            });
        });

        // URL inputs
        document.querySelectorAll('.menu-url-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                clearTimeout(menuDebounceTimers[`url-${index}`]);
                menuDebounceTimers[`url-${index}`] = setTimeout(() => {
                    headerState.content.menu[index].href = e.target.value;
                    updateHeaderContent();
                }, 300);
            });
        });

        // Delete buttons
        document.querySelectorAll('.menu-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('.header-item-delete-btn').dataset.index);
                headerState.content.menu.splice(index, 1);
                renderMenuList();
                updateHeaderContent();
            });
        });
    }

    function addMenuItem() {
        if (headerState.content.menu.length >= 6) return;
        headerState.content.menu.push({ label: 'Link', href: '#' });
        renderMenuList();
        updateHeaderContent();
    }

    // ============================================
    // ACTIONS EDITING
    // ============================================
    function renderActionsList() {
        const container = document.getElementById('actions-items-container');
        const note = document.getElementById('actions-note');
        if (!container || !note) return;

        const ctaType = headerState.config.ctaType;
        const actions = headerState.content.actions;

        // Show note for icons or none
        if (ctaType === 'icons' || ctaType === 'none') {
            container.style.display = 'none';
            note.style.display = 'flex';
            return;
        }

        container.style.display = 'flex';
        note.style.display = 'none';

        // Render based on ctaType
        if (ctaType === '2-buttons') {
            container.innerHTML = `
                <div class="header-control-group">
                    <span class="header-control-label">Button 1</span>
                    <input type="text" class="header-input-field action-label-input" placeholder="Label" value="${escapeAttr(actions[0]?.label || 'Sign in')}" data-index="0" maxlength="30">
                    <input type="text" class="header-input-field action-url-input" placeholder="URL" value="${escapeAttr(actions[0]?.href || '#')}" data-index="0" style="margin-top: 0.5rem;">
                </div>
                <div class="header-control-group">
                    <span class="header-control-label">Button 2</span>
                    <input type="text" class="header-input-field action-label-input" placeholder="Label" value="${escapeAttr(actions[1]?.label || 'Get Started')}" data-index="1" maxlength="30">
                    <input type="text" class="header-input-field action-url-input" placeholder="URL" value="${escapeAttr(actions[1]?.href || '#')}" data-index="1" style="margin-top: 0.5rem;">
                </div>
            `;
        } else if (ctaType === 'button') {
            container.innerHTML = `
                <div class="header-control-group">
                    <span class="header-control-label">Button</span>
                    <input type="text" class="header-input-field action-label-input" placeholder="Label" value="${escapeAttr(actions[1]?.label || 'Get Started')}" data-index="1" maxlength="30">
                    <input type="text" class="header-input-field action-url-input" placeholder="URL" value="${escapeAttr(actions[1]?.href || '#')}" data-index="1" style="margin-top: 0.5rem;">
                </div>
            `;
        }

        bindActionsInputs();
    }

    let actionsDebounceTimers = {};
    function bindActionsInputs() {
        // Label inputs
        document.querySelectorAll('.action-label-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                clearTimeout(actionsDebounceTimers[`label-${index}`]);
                actionsDebounceTimers[`label-${index}`] = setTimeout(() => {
                    if (!headerState.content.actions[index]) {
                        headerState.content.actions[index] = { label: '', href: '#' };
                    }
                    headerState.content.actions[index].label = e.target.value;
                    updateHeaderContent();
                }, 300);
            });
        });

        // URL inputs
        document.querySelectorAll('.action-url-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                clearTimeout(actionsDebounceTimers[`url-${index}`]);
                actionsDebounceTimers[`url-${index}`] = setTimeout(() => {
                    if (!headerState.content.actions[index]) {
                        headerState.content.actions[index] = { label: '', href: '#' };
                    }
                    headerState.content.actions[index].href = e.target.value;
                    updateHeaderContent();
                }, 300);
            });
        });
    }

    // ============================================
    // PUBLIC API
    // ============================================
    function getConfig() {
        return {
            layoutId: headerState.layoutId,
            config: { ...headerState.config },
            content: JSON.parse(JSON.stringify(headerState.content)), // deep copy
            headerInserted: headerState.headerInserted
        };
    }

    function restore(savedConfig) {
        if (!savedConfig || !savedConfig.layoutId) return;

        headerState.layoutId = savedConfig.layoutId;
        headerState.config = { ...headerState.config, ...savedConfig.config };

        // Merge content if present (backward compat - use defaults if not present)
        if (savedConfig.content) {
            headerState.content = JSON.parse(JSON.stringify(savedConfig.content)); // deep copy
        }

        headerState.headerInserted = savedConfig.headerInserted || false;
        updateSidebarButton();
    }

    function isHeaderInserted() {
        return headerState.headerInserted;
    }

    // ============================================
    // EVENT BINDING
    // ============================================

    // Listen for HEADER_ZONE_CLICKED messages from iframe
    window.addEventListener('message', (event) => {
        if (event.data.type === 'HEADER_ZONE_CLICKED') {
            const zone = event.data.data.zone;

            // If panel is closed, open it first
            const panel = document.getElementById('header-panel');
            if (panel && !panel.classList.contains('show')) {
                openPanel();
            }

            // Show the appropriate sub-panel
            showSubPanel(zone);
        }
    });

    document.addEventListener('DOMContentLoaded', function() {
        // Layout card clicks (step 1)
        document.querySelectorAll('.header-layout-item').forEach(item => {
            item.addEventListener('click', () => {
                const layoutId = parseInt(item.getAttribute('data-layout'));
                if (layoutId) selectLayout(layoutId);
            });
        });

        // Mini layout switcher clicks (step 2)
        document.querySelectorAll('[data-layout-switch]').forEach(btn => {
            btn.addEventListener('click', () => {
                const layoutId = parseInt(btn.getAttribute('data-layout-switch'));
                if (layoutId && layoutId !== headerState.layoutId) {
                    // Remove active from all layout switcher buttons
                    document.querySelectorAll('[data-layout-switch]').forEach(b => b.classList.remove('active'));
                    // Add active to clicked button
                    btn.classList.add('active');
                    // Switch layout
                    selectLayout(layoutId);
                }
            });
        });

        // Option/segment button click handlers
        function bindOptionButtons(group, callback) {
            document.querySelectorAll(`[data-header-group="${group}"]`).forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll(`[data-header-group="${group}"]`).forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    callback(btn.dataset.headerValue);
                });
            });
        }

        bindOptionButtons('background', (val) => applyOption('background', val));
        bindOptionButtons('corners', (val) => applyOption('corners', val));
        bindOptionButtons('theme', (val) => applyOption('theme', val));
        bindOptionButtons('shadow', (val) => applyOption('shadow', val));
        bindOptionButtons('cta-type', (val) => applyCtaType(val));
        bindOptionButtons('cta-style', (val) => applyCtaStyle(val));

        // Advanced toggle
        const advToggle = document.getElementById('header-advanced-toggle');
        const advContent = document.getElementById('header-advanced-content');
        if (advToggle && advContent) {
            advToggle.addEventListener('click', () => {
                advToggle.classList.toggle('open');
                advContent.classList.toggle('open');
            });
        }

        // Close button
        const closeBtn = document.getElementById('header-panel-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closePanel);
        }

        // Remove button
        const removeBtn = document.getElementById('header-remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                removeHeader();
            });
        }

        // Sub-panel back buttons
        document.querySelectorAll('.header-sub-panel-back').forEach(btn => {
            btn.addEventListener('click', closeSubPanel);
        });

        // Logo type toggle
        const logoTypeText = document.getElementById('logo-type-text');
        const logoTypeImage = document.getElementById('logo-type-image');
        if (logoTypeText && logoTypeImage) {
            logoTypeText.addEventListener('click', () => {
                logoTypeText.classList.add('active');
                logoTypeImage.classList.remove('active');
                setLogoType('text');
            });
            logoTypeImage.addEventListener('click', () => {
                logoTypeImage.classList.add('active');
                logoTypeText.classList.remove('active');
                setLogoType('image');
            });
        }

        // Logo text input
        const logoTextInput = document.getElementById('logo-text-input');
        if (logoTextInput) {
            logoTextInput.addEventListener('input', (e) => {
                updateLogoText(e.target.value);
            });
        }

        // Logo upload area click
        const logoUploadArea = document.getElementById('logo-upload-area');
        if (logoUploadArea) {
            logoUploadArea.addEventListener('click', openLogoUpload);
        }

        // Add menu item button
        const addMenuBtn = document.getElementById('add-menu-item-btn');
        if (addMenuBtn) {
            addMenuBtn.addEventListener('click', addMenuItem);
        }

        // Render layout card previews
        renderLayoutPreviews();
    });

    function renderLayoutPreviews() {
        document.querySelectorAll('.header-layout-item').forEach(item => {
            const layoutId = parseInt(item.getAttribute('data-layout'));
            const previewEl = item.querySelector('.header-layout-preview');
            if (!previewEl || !layoutId) return;

            const inner = document.createElement('div');
            inner.className = 'header-layout-preview-inner header-layout-preview-mode';
            inner.innerHTML = getLayoutHtml(layoutId);
            previewEl.appendChild(inner);
        });
    }

    // ============================================
    // EXPOSE API
    // ============================================
    window.HeaderModal = {
        open: openPanel,
        close: closePanel,
        getConfig: getConfig,
        restore: restore,
        remove: removeHeader,
        isHeaderInserted: isHeaderInserted,
        _syncControls: syncControlsToState,
        _updateContent: updateHeaderContent
    };

})();
