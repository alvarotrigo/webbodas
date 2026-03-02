/**
 * Section Search Functionality using Fuse.js
 * 
 * This script provides search functionality for sections by:
 * 1. Loading Fuse.js from CDN
 * 2. Loading metadata.js for structured section data
 * 3. Combining sections data with metadata
 * 4. Displaying search results in category-hover-panel
 */

(function() {
    'use strict';

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        // Wait for sections to be available (they're set in app.php)
        function waitForSections(maxAttempts = 50) {
            return new Promise((resolve) => {
                let attempts = 0;
                const checkSections = () => {
                    if (window.sections && window.sections.length > 0) {
                        resolve();
                    } else if (attempts < maxAttempts) {
                        attempts++;
                        setTimeout(checkSections, 100);
                    } else {
                        console.warn('Sections not available after waiting');
                        resolve(); // Continue anyway, search will work with empty results
                    }
                };
                checkSections();
            });
        }

        // Load Fuse.js and metadata, then initialize search
        waitForSections().then(() => {
            console.log('Sections loaded:', window.sections?.length);
            return loadFuseJS();
        }).then(() => {
            console.log('Fuse.js loaded');
            return loadMetadata();
        }).then((metadata) => {
            console.log('Metadata loaded:', metadata?.length);
            initializeSearch(metadata);
        }).catch((error) => {
            console.error('Error initializing search:', error);
        });
    }

    // Fuse.js loading state
    let fuseLoadState = {
        loaded: false,
        loading: false,
        promise: null
    };

    /**
     * Load Fuse.js from CDN
     */
    function loadFuseJS() {
        // Return existing promise if already loading
        if (fuseLoadState.promise) {
            return fuseLoadState.promise;
        }
        
        // If already loaded, return resolved promise
        if (fuseLoadState.loaded || window.Fuse) {
            fuseLoadState.loaded = true;
            return Promise.resolve();
        }
        
        // Mark as loading and create promise
        fuseLoadState.loading = true;
        fuseLoadState.promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.min.js';
            script.async = true;
            script.onload = () => {
                fuseLoadState.loaded = true;
                fuseLoadState.loading = false;
                resolve();
            };
            script.onerror = () => {
                fuseLoadState.loading = false;
                fuseLoadState.promise = null; // Allow retry
                reject(new Error('Failed to load Fuse.js'));
            };
            document.head.appendChild(script);
        });
        
        return fuseLoadState.promise;
    }

    /**
     * Load metadata.js (JSON file)
     */
    function loadMetadata() {
        return new Promise((resolve) => {
            // Check if metadata is already loaded
            if (window.sectionMetadata) {
                resolve(window.sectionMetadata);
                return;
            }

            // Fetch metadata.js as JSON (use absolute path)
            const metadataPath = window.location.pathname.includes('/app.php') 
                ? './public/js/metadata.js' 
                : 'public/js/metadata.js';
            fetch(metadataPath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to load metadata.js');
                    }
                    return response.json();
                })
                .then(metadata => {
                    window.sectionMetadata = metadata;
                    resolve(metadata);
                })
                .catch(error => {
                    // If metadata.js fails, we'll work with just sections data
                    console.warn('metadata.js not found, using sections data only:', error);
                    window.sectionMetadata = [];
                    resolve([]);
                });
        });
    }

    /**
     * Initialize search functionality
     */
    function initializeSearch(metadata) {
        const searchInput = document.getElementById('section-search-input') || document.querySelector('.search-bar');
        const searchLoader = document.getElementById('search-loader');
        const categoryHoverPanel = document.getElementById('category-hover-panel');
        const categorySectionsGrid = document.getElementById('category-sections-grid');
        
        if (!searchInput || !categoryHoverPanel || !categorySectionsGrid) {
            console.warn('Search elements not found', { 
                searchInput: !!searchInput, 
                categoryHoverPanel: !!categoryHoverPanel,
                categorySectionsGrid: !!categorySectionsGrid
            });
            return;
        }

        // Get sections data from window (set in app.php)
        const sections = window.sections || [];
        
        console.log('Initializing search with', sections.length, 'sections and', metadata.length, 'metadata entries');
        
        // Combine sections with metadata
        const searchableData = sections.map(section => {
            const meta = metadata.find(m => m.id === section.id) || {};
            // Combine tags from section and metadata (remove duplicates)
            const allTags = [...new Set([
                ...(section.tags || []),
                ...(meta.tags || [])
            ])];
            
            return {
                ...section,
                // Add metadata fields for better search
                category: meta.category || '',
                layout: meta.layout || '',
                // Keep arrays as arrays - Fuse.js searches each element individually for better precision
                elements: meta.elements || [],
                style: meta.style || [],
                section_role: meta.section_role || '',
                // Include metadata tags and keywords as arrays
                metadataTags: allTags,
                keywords: meta.keywords || [],
                // Create a searchable text field for fallback/combined search
                searchText: [
                    section.name,
                    allTags.join(' '),
                    (meta.keywords || []).join(' '),
                    meta.category || '',
                    meta.layout || '',
                    meta.section_role || '',
                    (meta.elements || []).join(' '),
                    (meta.style || []).join(' ')
                ].filter(Boolean).join(' ').toLowerCase()
            };
        });

        // Base synonym groups by concept
        const BASE_SYNONYM_GROUPS = {
            // 🧷 Devices / UI
            phone: [
                "phone",
                "mobile",
                "smartphone",
                "cell phone",
                "mobile screen",
                "phone mockup",
                "app screen"
            ],
            app: [
                "app",
                "application",
                "mobile app",
                "web app",
                "product ui",
                "product screen",
                "saas app",
                "app interface"
            ],
            dashboard: [
                "dashboard",
                "analytics",
                "metrics dashboard",
                "admin panel",
                "analytics screen"
            ],
            desktop: [
                "desktop",
                "laptop",
                "computer",
                "desktop screen"
            ],
            tablet: [
                "tablet",
                "ipad",
                "tablet screen"
            ],
            // 🧱 Layout / structure
            split: [
                "split",
                "split layout",
                "two column",
                "two columns",
                "side by side",
                "media left",
                "media right"
            ],
            grid: [
                "grid",
                "grid layout",
                "cards",
                "card grid",
                "tiles",
                "gallery",
                "masonry"
            ],
            list: [
                "list",
                "bullet list",
                "bullets",
                "bullet points",
                "feature list",
                "checklist"
            ],
            slider: [
                "slider",
                "carousel",
                "slideshow",
                "scrolling cards",
                "testimonial slider"
            ],
            centered: [
                "centered",
                "center",
                "centered layout",
                "centered content"
            ],
            fullwidth: [
                "full width",
                "full-width",
                "edge to edge",
                "wide layout"
            ],
            // 🌟 Trust / social proof / logos
            reviews: [
                "reviews",
                "review",
                "customer reviews",
                "user reviews",
                "ratings",
                "stars",
                "star rating"
            ],
            testimonials: [
                "testimonials",
                "testimonial",
                "customer stories",
                "success stories",
                "client quotes",
                "customer feedback"
            ],
            logos: [
                "logos",
                "logo",
                "logo cloud",
                "clients",
                "brands",
                "trusted by",
                "companies",
                "partners"
            ],
            trust: [
                "trust",
                "trust signals",
                "guarantee",
                "security",
                "compliance",
                "certifications",
                "social proof"
            ],
            // 💰 Pricing / money / plans
            pricing: [
                "pricing",
                "price",
                "prices",
                "plans",
                "packages",
                "tier",
                "tiers",
                "subscription",
                "billing"
            ],
            comparison: [
                "comparison",
                "compare",
                "vs",
                "vs.",
                "side by side",
                "plan comparison"
            ],
            // 📩 Forms / capture
            form: [
                "form",
                "forms",
                "contact form",
                "signup form",
                "registration form",
                "lead form",
                "newsletter form"
            ],
            contact: [
                "contact",
                "contact us",
                "get in touch",
                "support",
                "help",
                "talk to us"
            ],
            newsletter: [
                "newsletter",
                "subscribe",
                "email signup",
                "email list",
                "mailing list",
                "newsletter signup"
            ],
            // 🎯 CTA / actions
            cta: [
                "cta",
                "call to action",
                "cta section",
                "cta banner",
                "cta block"
            ],
            buttons: [
                "button",
                "buttons",
                "primary button",
                "secondary button",
                "get started",
                "try now",
                "sign up",
                "join now",
                "start free trial"
            ],
            // ❓ FAQ / help
            faq: [
                "faq",
                "faqs",
                "questions",
                "common questions",
                "help center",
                "support questions"
            ],
            support: [
                "support",
                "help",
                "customer support",
                "help center"
            ],
            // 🔁 Steps / process / how it works
            steps: [
                "steps",
                "process",
                "how it works",
                "workflow",
                "timeline",
                "onboarding steps",
                "getting started"
            ],
            onboarding: [
                "onboarding",
                "get started",
                "getting started",
                "first steps",
                "setup"
            ],
            // 📊 Metrics / stats / results
            stats: [
                "stats",
                "statistics",
                "numbers",
                "metrics",
                "kpis",
                "results",
                "impact"
            ],
            results: [
                "results",
                "outcomes",
                "impact",
                "performance",
                "growth"
            ],
            // 🎥 Media / video / gallery
            gallery: [
                "gallery",
                "photos",
                "images",
                "photo gallery",
                "screenshots",
                "image gallery"
            ],
            video: [
                "video",
                "videos",
                "promo video",
                "demo video",
                "product video",
                "video section",
                "video hero"
            ],
            media: [
                "media",
                "media block",
                "image and text",
                "mixed media",
                "visual section"
            ],
            // 👥 About / team / company
            team: [
                "team",
                "our team",
                "founders",
                "people",
                "staff",
                "company team"
            ],
            about: [
                "about",
                "about us",
                "members",
                "team",
                "our story",
                "company",
                "who we are"
            ],
            // 🧩 Integrations / apps / API
            integrations: [
                "integrations",
                "integration",
                "api",
                "connect",
                "apps",
                "plugins",
                "third party",
                "tool integrations"
            ],
            // 📰 Content / blog / resources
            blog: [
                "blog",
                "articles",
                "posts",
                "news",
                "stories",
                "resources"
            ],
            content: [
                "content",
                "text section",
                "rich text",
                "article block",
                "copy section",
                "long form"
            ],
            // 📅 Events / webinars
            events: [
                "event",
                "events",
                "webinar",
                "workshop",
                "conference",
                "meetup",
                "online event"
            ],
            // 🧭 Navigation / footer / structure
            navigation: [
                "navigation",
                "nav",
                "menu",
                "site menu",
                "top bar",
                "navbar"
            ],
            footer: [
                "footer",
                "page footer",
                "bottom",
                "bottom section",
                "site footer"
            ],
            // 🏪 App stores / downloads
            appstore: [
                "app store",
                "play store",
                "download app",
                "app badges",
                "google play",
                "ios app",
                "android app"
            ],
            signin:[
                "sign in",
                "signin",
                "login",
                "log in",
                "sign on",
                "authenticate",
                "account access",
                "user login",
                "sign up"
            ]
        };

        /**
         * Expand synonym groups into a flat map where each term maps to all synonyms in its group
         */
        function expandManualMap(map) {
            const result = {};
            for (const key in map) {
                const group = map[key];
                group.forEach(term => {
                    const normalized = term.toLowerCase().trim();
                    const merged = [...group].map(t => t.toLowerCase().trim());
                    result[normalized] = [...new Set(merged)];
                });
            }
            return result;
        }

        const MANUAL_SYNONYMS = expandManualMap(BASE_SYNONYM_GROUPS);

        /**
         * Expand query with synonyms
         * Returns an array of search terms (original query + synonyms)
         */
        function expandQueryWithSynonyms(query) {
            const normalizedQuery = query.toLowerCase().trim();
            const queryWords = normalizedQuery.split(/\s+/);
            const expandedTerms = new Set([normalizedQuery]); // Always include original query
            
            // Check each word in the query
            queryWords.forEach(word => {
                if (MANUAL_SYNONYMS[word]) {
                    // Add all synonyms for this word
                    MANUAL_SYNONYMS[word].forEach(synonym => {
                        expandedTerms.add(synonym);
                    });
                }
            });
            
            // Also check if the entire query (or phrases) match
            if (MANUAL_SYNONYMS[normalizedQuery]) {
                MANUAL_SYNONYMS[normalizedQuery].forEach(synonym => {
                    expandedTerms.add(synonym);
                });
            }
            
            // Limit expansion to prevent too many results
            // Only keep the most relevant synonyms (original + first 5 synonyms)
            const termsArray = Array.from(expandedTerms);
            if (termsArray.length > 6) {
                // Keep original query + first 5 synonyms
                const limited = [normalizedQuery, ...termsArray.slice(1, 6)];
                return limited;
            }
            
            return termsArray;
        }

        // Base Fuse.js options (threshold will be set dynamically)
        const baseFuseOptions = {
            keys: [
                { name: 'name', weight: 0.5 }, // Boosted from 0.4 for exact matches
                { name: 'category', weight: 0.35 }, // Increased from 0.15 - category is very important
                { name: 'metadataTags', weight: 0.3 }, // Combined tags from section + metadata
                { name: 'keywords', weight: 0.25 }, // Keywords from metadata
                { name: 'tags', weight: 0.2 }, // Original section tags (fallback)
                { name: 'layout', weight: 0.1 },
                { name: 'section_role', weight: 0.1 },
                { name: 'elements', weight: 0.05 },
                { name: 'style', weight: 0.05 },
                { name: 'searchText', weight: 0.1 }
            ],
            includeScore: true,
            // includeMatches: true, // Include match information for debugging
            minMatchCharLength: 4, // Increased from 2 for better precision
            // Use distance to prevent substring matches (e.g., "tier" matching "entire", "frontier")
            distance: 50, // Limit how far apart matched characters can be
            ignoreLocation: true,
            findAllMatches: false,
            shouldSort: true // Enable result sorting by relevance
        };

        // Function to get dynamic threshold based on query length
        function getDynamicThreshold(queryLength) {
            if (queryLength <= 2) {
                return 0.3; // More results for short queries
            } else if (queryLength >= 6) {
                return 0.5; // More precise for long queries
            }
            return 0.4; // Default threshold for medium queries (3-5 chars)
        }

        // Function to create Fuse instance with dynamic threshold
        function createFuseInstance(threshold) {
            return new Fuse(searchableData, {
                ...baseFuseOptions,
                threshold: threshold
            });
        }

        // Initialize Fuse.js with default threshold
        let fuse = createFuseInstance(0.4);

        let isSearchActive = false;

        /**
         * Show loader
         */
        function showLoader() {
            if (searchLoader) {
                searchLoader.classList.add('active');
            }
        }

        /**
         * Hide loader
         */
        function hideLoader() {
            if (searchLoader) {
                searchLoader.classList.remove('active');
            }
        }

        /**
         * Show search results in category-hover-panel
         */
        function showSearchResults(matchedSections) {
            if (!matchedSections || matchedSections.length === 0) {
                showNoResults();
                return;
            }

            // Update panel header
            const headerTitle = categoryHoverPanel.querySelector('.category-hover-panel-title');
            if (headerTitle) {
                headerTitle.innerHTML = `
                    <i data-lucide="search"></i>
                    <span>Search Results (${matchedSections.length})</span>
                `;
            }

            // Clear existing sections
            categorySectionsGrid.innerHTML = '';

            // Add sections using the same format as category panel
            matchedSections.forEach(section => {
                const sectionElement = createSearchSectionItem(section);
                categorySectionsGrid.insertAdjacentHTML('beforeend', sectionElement);
            });

            // Reset scroll position to top
            categorySectionsGrid.scrollTop = 0;

            // Clear current category tracking since we're showing search results
            if (typeof window.resetCurrentCategory === 'function') {
                window.resetCurrentCategory();
            }

            // Set search mode flag to prevent auto-hide on mouse leave
            categoryHoverPanel.dataset.searchMode = 'true';

            // Show panel
            categoryHoverPanel.classList.add('show');

            // Close theme panel if open
            if (typeof closeThemePanel === 'function') {
                closeThemePanel();
            }

            // Recreate icons
            if (window.lucide && window.lucide.createIcons) {
                window.lucide.createIcons();
            }

            // Setup intersection observer for lazy loading if function exists
            if (typeof setupCategorySectionObserver === 'function') {
                const categoryObserver = setupCategorySectionObserver();
                const sectionItems = categorySectionsGrid.querySelectorAll('.category-section-item');
                sectionItems.forEach(item => {
                    categoryObserver.observe(item);
                });
            }
        }

        /**
         * Show "no results" message
         */
        function showNoResults() {
            const headerTitle = categoryHoverPanel.querySelector('.category-hover-panel-title');
            if (headerTitle) {
                headerTitle.innerHTML = `
                    <i data-lucide="search"></i>
                    <span>No Results</span>
                `;
            }

            categorySectionsGrid.innerHTML = `
                <div style="padding: 3rem 1rem; text-align: center; color: var(--secondary-text, #666);">
                    <p style="font-size: 0.9rem; margin: 0;">No sections found matching your search.</p>
                </div>
            `;

            // Reset scroll position to top
            categorySectionsGrid.scrollTop = 0;

            // Clear current category tracking since we're showing search results
            if (typeof window.resetCurrentCategory === 'function') {
                window.resetCurrentCategory();
            }

            // Set search mode flag to prevent auto-hide on mouse leave
            categoryHoverPanel.dataset.searchMode = 'true';

            categoryHoverPanel.classList.add('show');

            if (window.lucide && window.lucide.createIcons) {
                window.lucide.createIcons();
            }
        }

        /**
         * Hide search panel
         */
        function hideSearchPanel() {
            // Clear search mode flag
            categoryHoverPanel.dataset.searchMode = 'false';
            categoryHoverPanel.classList.remove('show');
        }

        /**
         * Create section item HTML (same format as category panel)
         */
        function createSearchSectionItem(section) {
            // Use the same function from app.php if available
            if (typeof createCategorySectionItem === 'function') {
                return createCategorySectionItem(section);
            }

            // Fallback implementation
            const isProSection = section.is_pro === 1;
            const isPaidUser = window.editorMode === 'paid';
            
            // Check if background tab is active
            const panel = document.getElementById('category-hover-panel');
            const activeTab = panel?.querySelector('.category-tab.active');
            const isBackgroundTab = activeTab && activeTab.dataset.tab === 'background';
            
            const sectionId = section.id;
            // Use -bg suffix if background tab is active and user is not paid
            const imageSuffix = (isProSection && !isPaidUser && isBackgroundTab) ? '-bg' : '';
            
            return `
                <div class="category-section-item ${isProSection ? 'pro-section' : ''} ${isProSection && isPaidUser ? 'paid-user' : ''}" data-section="${sectionId}" data-file="${section.file}" data-is-pro="${section.is_pro}">
                    <div class="category-section-number">${sectionId}</div>
                    <div class="category-section-content">
                        ${isProSection && !isPaidUser ? 
                            `<div class="category-thumbnail-loader"></div>
                             <div class="category-section-content-inner @container">
                                <img src="screenshots/${sectionId}${imageSuffix}.jpg" alt="${section.name}" class="section-thumbnail" onload="this.closest('.category-section-content').querySelector('.category-thumbnail-loader').style.display='none';" onerror="this.style.display='none';">
                             </div>` 
                            : 
                            `<div class="category-thumbnail-loader"></div>
                             <div class="category-section-content-inner @container"></div>`
                        }
                    </div>
                    <div class="category-section-overlay">
                        <button class="category-section-add-button" style="display: ${isProSection && !isPaidUser ? 'none' : 'flex'};">+</button>
                    </div>
                    ${isProSection && !isPaidUser ? '<div class="category-section-lock" data-tippy-content="Premium section - Upgrade to PRO to unlock"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock-icon lucide-lock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>' : ''}
                </div>
            `;
        }

        /**
         * Perform search and update UI
         */
        function performSearch(query) {
            const trimmedQuery = query.trim().toLowerCase();
            
            if (!trimmedQuery) {
                // Hide panel and loader if search is cleared
                if (isSearchActive) {
                    hideSearchPanel();
                    hideLoader();
                    isSearchActive = false;
                }
                return;
            }

            isSearchActive = true;
            showLoader();

            // Get dynamic threshold based on query length
            const queryLength = trimmedQuery.length;
            const dynamicThreshold = getDynamicThreshold(queryLength);
            
            // Create new Fuse instance with dynamic threshold for this search
            const searchFuse = createFuseInstance(dynamicThreshold);

            // Expand query with synonyms
            const expandedTerms = expandQueryWithSynonyms(trimmedQuery);
            
            // console.log('🔍 Search Debug:', {
            //     originalQuery: trimmedQuery,
            //     expandedTerms: expandedTerms,
            //     threshold: dynamicThreshold
            // });
            
            // Perform search with all expanded terms and merge results
            const allResults = new Map(); // Use Map to deduplicate by section ID
            // const matchDetails = new Map(); // Track which term matched each section (for debugging)
            
            expandedTerms.forEach(term => {
                const termResults = searchFuse.search(term);
                termResults.forEach(result => {
                    const sectionId = result.item.id;
                    // Keep the best (lowest) score for each section
                    if (!allResults.has(sectionId) || (result.score || 1) < (allResults.get(sectionId).score || 1)) {
                        allResults.set(sectionId, result);
                        // Track which term matched and what keys matched (for debugging)
                        // matchDetails.set(sectionId, {
                        //     matchedTerm: term,
                        //     matchedKeys: result.matches ? result.matches.map(m => m.key).join(', ') : 'unknown',
                        //     matches: result.matches || []
                        // });
                    }
                });
            });
            
            // Convert Map back to array
            const results = Array.from(allResults.values());
            
            // Debug: Log match details for all results
            // console.log('📊 Match Details (all results):');
            // results.forEach((result, idx) => {
            //     const details = matchDetails.get(result.item.id);
            //     
            //     // Extract exact matched substrings using indices
            //     const exactMatches = details?.matches?.map(m => {
            //         const value = typeof m.value === 'string' ? m.value : (Array.isArray(m.value) ? m.value.join(', ') : String(m.value));
            //         const matchedSubstrings = [];
            //         
            //         if (m.indices && m.indices.length > 0) {
            //             // Extract each matched substring using the indices
            //             m.indices.forEach(([start, end]) => {
            //                 const matchedText = value.substring(start, end + 1);
            //                 matchedSubstrings.push(`"${matchedText}"`);
            //             });
            //         }
            //         
            //         return {
            //             key: m.key,
            //             fullValue: value,
            //             matchedSubstrings: matchedSubstrings.length > 0 ? matchedSubstrings.join(', ') : 'no indices',
            //             indices: m.indices
            //         };
            //     }) || [];
            //     
            //     console.log(`${idx + 1}. Section ${result.item.id} (${result.item.category || 'no category'}) - Score: ${result.score?.toFixed(4)}`, {
            //         matchedTerm: details?.matchedTerm,
            //         matchedKeys: details?.matchedKeys,
            //         exactMatches: exactMatches.map(m => `${m.key}: matched [${m.matchedSubstrings}] in "${m.fullValue.substring(0, 100)}${m.fullValue.length > 100 ? '...' : ''}"`),
            //         name: result.item.name,
            //         category: result.item.category
            //     });
            // });
            
            // Debug: Show all pricing sections found
            // const pricingResults = results.filter(r => r.item.category === 'pricing');
            // console.log(`💰 Pricing sections found: ${pricingResults.length}`, pricingResults.map(r => ({
            //     id: r.item.id,
            //     name: r.item.name,
            //     score: r.score?.toFixed(4),
            //     matchedTerm: matchDetails.get(r.item.id)?.matchedTerm
            // })));
            
            // Debug: Count by category
            // const categoryCounts = {};
            // results.forEach(r => {
            //     const cat = r.item.category || 'no category';
            //     categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
            // });
            // console.log('📈 Results by category:', categoryCounts);
            
            // Post-process results to boost exact matches in name field
            const processedResults = results.map(result => {
                const item = result.item;
                const queryLower = trimmedQuery.toLowerCase();
                const nameLower = (item.name || '').toLowerCase();
                
                // Boost score if name is an exact match
                let adjustedScore = result.score || 1;
                if (nameLower === queryLower) {
                    // Exact match - significantly boost
                    adjustedScore = adjustedScore * 0.1; // Much lower score = higher relevance
                } else if (nameLower.startsWith(queryLower)) {
                    // Starts with query - moderate boost
                    adjustedScore = adjustedScore * 0.7;
                } else if (nameLower.includes(queryLower)) {
                    // Contains query - slight boost
                    adjustedScore = adjustedScore * 0.9;
                }
                
                return {
                    ...result,
                    score: adjustedScore
                };
            });
            
            // Sort by adjusted score (lower is better)
            processedResults.sort((a, b) => (a.score || 1) - (b.score || 1));
            
            const matchedSections = processedResults.map(result => result.item);

            // console.log('Search query:', trimmedQuery, 'Expanded terms:', expandedTerms.length, 'Length:', queryLength, 'Threshold:', dynamicThreshold, 'Results:', matchedSections.length);

            // Hide loader and show results
            setTimeout(() => {
                hideLoader();
                showSearchResults(matchedSections);
            }, 100);
        }

        // Debounce function to limit search frequency
        let searchTimeout;
        function debounceSearch(query) {
            clearTimeout(searchTimeout);
            showLoader();
            searchTimeout = setTimeout(() => {
                performSearch(query);
            }, 300); // 300ms delay
        }

        // Add event listener to search input
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            if (query.trim()) {
                debounceSearch(query);
            } else {
                clearTimeout(searchTimeout);
                hideLoader();
                hideSearchPanel();
                isSearchActive = false;
            }
        });

        // Clear search on Escape key
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                clearTimeout(searchTimeout);
                hideLoader();
                hideSearchPanel();
                isSearchActive = false;
            }
        });

        // Close panel when clicking close button
        const closeButton = categoryHoverPanel.querySelector('.category-hover-panel-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                hideSearchPanel();
                searchInput.value = '';
                isSearchActive = false;
                // Also call the global hideCategoryPanel to ensure sidebar toggle is updated
                if (typeof hideCategoryPanel === 'function') {
                    hideCategoryPanel();
                }
            });
        }

        console.log('Section search initialized');
    }
})();
