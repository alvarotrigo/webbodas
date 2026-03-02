/**
 * Download Options Handler
 * Manages different export formats (HTML, React, etc.)
 */

class DownloadOptionsHandler {
    constructor() {
        // React project generation now handled by PHP backend
        this.currentTab = 'download'; // Track current tab
        this.successShown = false; // Track if success message was shown
    }

    /**
     * Show upgrade modal for non-pro users
     */
    async showUpgradeModal() {
        // Check if upgrade modal is available
        if (typeof window.upgradeModal !== 'undefined' && window.upgradeModal) {
            await window.upgradeModal.show();
        } else {
            // Fallback: show alert
            alert('GitHub Export is a Pro feature. Please upgrade to continue.');
        }
    }

    /**
     * Show download options modal with tabs
     */
    showDownloadOptions() {
        // Create modal HTML with tabs
        const modalHTML = `
            <div id="download-options-modal" class="modal-overlay fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[10000]" style="display: flex;">
                <div class="bg-[var(--primary-bg)] rounded-2xl shadow-2xl max-w-2xl w-full mx-4 github-export-content" onclick="event.stopPropagation()">
                    <div class="p-8">
                        <!-- Tabs -->
                        <div class="flex gap-2 mb-6 bg-[var(--accent-bg)] p-1 rounded-xl">
                            <button onclick="window.downloadOptionsHandler.switchTab('download')" id="tab-download" class="flex-1 py-3 px-6 rounded-lg font-semibold transition-all bg-[var(--primary-bg)] color-[var(--accent-text)] shadow-sm">
                                <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                                </svg>
                                Download
                            </button>
                            <button onclick="window.downloadOptionsHandler.switchTab('github')" id="tab-github" class="flex-1 py-3 px-6 rounded-lg font-semibold transition-all text-[var(--secondary-text)] hover:text-[var(--primary-text)]">
                                <svg class="w-5 h-5 inline-block mr-2" fill="currentColor" viewBox="0 0 16 16">
                                    <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                                </svg>
                                GitHub Sync
                            </button>
                        </div>

                        <!-- Download Tab Content -->
                        <div id="content-download" class="tab-content">
                            <p class="text-[var(--secondary-text)] mb-4 text-center">Download your project files</p>
                        <div class="grid grid-cols-2 gap-4">
                            <!-- HTML Export Option -->
                            <button onclick="window.downloadOptionsHandler.exportHTML()" class="p-6 border-2 border-[var(--border-color)] rounded-xl hover:border-orange-500 hover:shadow-lg transition-all text-center group">
                                <div class="flex flex-col items-center gap-3">
                                    <div class="w-20 h-20 bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl flex items-center justify-center group-hover:from-orange-100 group-hover:to-red-100 transition-all transform group-hover:scale-105">
                                        <svg viewBox="0 0 32 32" width="40" height="40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M6 28L4 3H28L26 28L16 31L6 28Z" fill="#E44D26"></path>
                                            <path d="M26 5H16V29.5L24 27L26 5Z" fill="#F16529"></path>
                                            <path d="M9.5 17.5L8.5 8H24L23.5 11H11.5L12 14.5H23L22 24L16 26L10 24L9.5 19H12.5L13 21.5L16 22.5L19 21.5L19.5 17.5H9.5Z" fill="white"></path>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 class="font-bold text-[var(--primary-text)] text-lg">HTML + CSS</h3>
                                        <p class="text-sm text-[var(--secondary-text)] mt-1">Static website</p>
                                    </div>
                                </div>
                            </button>

                            <!-- React Export Option -->
                            <div class="relative p-6 border-2 border-[var(--border-color)] rounded-xl text-center opacity-50" style="cursor: not-allowed;">
                                <div class="absolute top-2 right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full font-semibold" style="cursor: not-allowed;">
                                    Coming soon...
                                </div>
                                <div class="flex flex-col items-center gap-3" style="cursor: not-allowed;">
                                    <div class="w-20 h-20 bg-gradient-to-br from-sky-100 to-cyan-50 rounded-2xl flex items-center justify-center" style="cursor: not-allowed;">
                                        <svg width="40" height="40" viewBox="175.7 78 490.6 436.9" xmlns="http://www.w3.org/2000/svg">
                                            <g fill="rgb(14, 165, 233)">
                                                <path d="m666.3 296.5c0-32.5-40.7-63.3-103.1-82.4 14.4-63.6 8-114.2-20.2-130.4-6.5-3.8-14.1-5.6-22.4-5.6v22.3c4.6 0 8.3.9 11.4 2.6 13.6 7.8 19.5 37.5 14.9 75.7-1.1 9.4-2.9 19.3-5.1 29.4-19.6-4.8-41-8.5-63.5-10.9-13.5-18.5-27.5-35.3-41.6-50 32.6-30.3 63.2-46.9 84-46.9v-22.3c-27.5 0-63.5 19.6-99.9 53.6-36.4-33.8-72.4-53.2-99.9-53.2v22.3c20.7 0 51.4 16.5 84 46.6-14 14.7-28 31.4-41.3 49.9-22.6 2.4-44 6.1-63.6 11-2.3-10-4-19.7-5.2-29-4.7-38.2 1.1-67.9 14.6-75.8 3-1.8 6.9-2.6 11.5-2.6v-22.3c-8.4 0-16 1.8-22.6 5.6-28.1 16.2-34.4 66.7-19.9 130.1-62.2 19.2-102.7 49.9-102.7 82.3 0 32.5 40.7 63.3 103.1 82.4-14.4 63.6-8 114.2 20.2 130.4 6.5 3.8 14.1 5.6 22.5 5.6 27.5 0 63.5-19.6 99.9-53.6 36.4 33.8 72.4 53.2 99.9 53.2 8.4 0 16-1.8 22.6-5.6 28.1-16.2 34.4-66.7 19.9-130.1 62-19.1 102.5-49.9 102.5-82.3zm-130.2-66.7c-3.7 12.9-8.3 26.2-13.5 39.5-4.1-8-8.4-16-13.1-24-4.6-8-9.5-15.8-14.4-23.4 14.2 2.1 27.9 4.7 41 7.9zm-45.8 106.5c-7.8 13.5-15.8 26.3-24.1 38.2-14.9 1.3-30 2-45.2 2-15.1 0-30.2-.7-45-1.9-8.3-11.9-16.4-24.6-24.2-38-7.6-13.1-14.5-26.4-20.8-39.8 6.2-13.4 13.2-26.8 20.7-39.9 7.8-13.5 15.8-26.3 24.1-38.2 14.9-1.3 30-2 45.2-2 15.1 0 30.2.7 45 1.9 8.3 11.9 16.4 24.6 24.2 38 7.6 13.1 14.5 26.4 20.8 39.8-6.3 13.4-13.2 26.8-20.7 39.9zm32.3-13c5.4 13.4 10 26.8 13.8 39.8-13.1 3.2-26.9 5.9-41.2 8 4.9-7.7 9.8-15.6 14.4-23.7 4.6-8 8.9-16.1 13-24.1zm-101.4 106.7c-9.3-9.6-18.6-20.3-27.8-32 9 .4 18.2.7 27.5.7 9.4 0 18.7-.2 27.8-.7-9 11.7-18.3 22.4-27.5 32zm-74.4-58.9c-14.2-2.1-27.9-4.7-41-7.9 3.7-12.9 8.3-26.2 13.5-39.5 4.1 8 8.4 16 13.1 24s9.5 15.8 14.4 23.4zm73.9-208.1c9.3 9.6 18.6 20.3 27.8 32-9-.4-18.2-.7-27.5-.7-9.4 0-18.7.2-27.8.7 9-11.7 18.3-22.4 27.5-32zm-74 58.9c-4.9 7.7-9.8 15.6-14.4 23.7-4.6 8-8.9 16-13 24-5.4-13.4-10-26.8-13.8-39.8 13.1-3.1 26.9-5.8 41.2-7.9zm-90.5 125.2c-35.4-15.1-58.3-34.9-58.3-50.6s22.9-35.6 58.3-50.6c8.6-3.7 18-7 27.7-10.1 5.7 19.6 13.2 40 22.5 60.9-9.2 20.8-16.6 41.1-22.2 60.6-9.9-3.1-19.3-6.5-28-10.2zm53.8 142.9c-13.6-7.8-19.5-37.5-14.9-75.7 1.1-9.4 2.9-19.3 5.1-29.4 19.6 4.8 41 8.5 63.5 10.9 13.5 18.5 27.5 35.3 41.6 50-32.6 30.3-63.2 46.9-84 46.9-4.5-.1-8.3-1-11.3-2.7zm237.2-76.2c4.7 38.2-1.1 67.9-14.6 75.8-3 1.8-6.9 2.6-11.5 2.6-20.7 0-51.4-16.5-84-46.6 14-14.7 28-31.4 41.3-49.9 22.6-2.4 44-6.1 63.6-11 2.3 10.1 4.1 19.8 5.2 29.1zm38.5-66.7c-8.6 3.7-18 7-27.7 10.1-5.7-19.6-13.2-40-22.5-60.9 9.2-20.8 16.6-41.1 22.2-60.6 9.9 3.1 19.3 6.5 28.1 10.2 35.4 15.1 58.3 34.9 58.3 50.6-.1 15.7-23 35.6-58.4 50.6z"/>
                                                <circle cx="420.9" cy="296.5" r="45.7"/>
                                            </g>
                                        </svg>
                                    </div>
                                    <div style="cursor: not-allowed;">
                                        <h3 class="font-bold text-[var(--primary-text)] text-lg" style="cursor: not-allowed;">React + Vite</h3>
                                        <p class="text-sm text-[var(--secondary-text)] mt-1" style="cursor: not-allowed;">Modern framework</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- GitHub Tab Content (hidden by default) -->
                    <div id="content-github" class="tab-content hidden">
                        <p class="text-[var(--secondary-text)] mb-4 text-center">Push your project directly to GitHub</p>

                        <!-- Export Format Selection -->
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-[var(--primary-text)] mb-3">Export Format</label>
                            <div class="grid grid-cols-2 gap-3">
                                <label class="export-format-option relative flex items-center p-4 border-2 border-[var(--border-color)] rounded-lg cursor-pointer hover:border-blue-500 transition-all">
                                    <input type="radio" name="github-format" value="html" class="mr-3" checked>
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg flex items-center justify-center">
                                            <svg viewBox="0 0 32 32" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M6 28L4 3H28L26 28L16 31L6 28Z" fill="#E44D26"></path>
                                                <path d="M26 5H16V29.5L24 27L26 5Z" fill="#F16529"></path>
                                                <path d="M9.5 17.5L8.5 8H24L23.5 11H11.5L12 14.5H23L22 24L16 26L10 24L9.5 19H12.5L13 21.5L16 22.5L19 21.5L19.5 17.5H9.5Z" fill="white"></path>
                                            </svg>
                                        </div>
                                        <div>
                                            <div class="font-semibold text-[var(--primary-text)]">HTML + CSS</div>
                                            <div class="text-xs text-[var(--secondary-text)]">Static website</div>
                                        </div>
                                    </div>
                                </label>
                                <div class="export-format-option relative flex items-center p-4 border-2 border-[var(--border-color)] rounded-lg opacity-50" style="cursor: not-allowed;">
                                    <input type="radio" name="github-format" value="react" class="mr-3" style="cursor: not-allowed;" disabled>
                                    <div class="flex items-center gap-3" style="cursor: not-allowed;">
                                        <div class="w-10 h-10 bg-gradient-to-br from-sky-100 to-cyan-50 rounded-lg flex items-center justify-center" style="cursor: not-allowed;">
                                            <svg width="24" height="24" viewBox="175.7 78 490.6 436.9" xmlns="http://www.w3.org/2000/svg">
                                                <g fill="rgb(14, 165, 233)">
                                                    <path d="m666.3 296.5c0-32.5-40.7-63.3-103.1-82.4 14.4-63.6 8-114.2-20.2-130.4-6.5-3.8-14.1-5.6-22.4-5.6v22.3c4.6 0 8.3.9 11.4 2.6 13.6 7.8 19.5 37.5 14.9 75.7-1.1 9.4-2.9 19.3-5.1 29.4-19.6-4.8-41-8.5-63.5-10.9-13.5-18.5-27.5-35.3-41.6-50 32.6-30.3 63.2-46.9 84-46.9v-22.3c-27.5 0-63.5 19.6-99.9 53.6-36.4-33.8-72.4-53.2-99.9-53.2v22.3c20.7 0 51.4 16.5 84 46.6-14 14.7-28 31.4-41.3 49.9-22.6 2.4-44 6.1-63.6 11-2.3-10-4-19.7-5.2-29-4.7-38.2 1.1-67.9 14.6-75.8 3-1.8 6.9-2.6 11.5-2.6v-22.3c-8.4 0-16 1.8-22.6 5.6-28.1 16.2-34.4 66.7-19.9 130.1-62.2 19.2-102.7 49.9-102.7 82.3 0 32.5 40.7 63.3 103.1 82.4-14.4 63.6-8 114.2 20.2 130.4 6.5 3.8 14.1 5.6 22.5 5.6 27.5 0 63.5-19.6 99.9-53.6 36.4 33.8 72.4 53.2 99.9 53.2 8.4 0 16-1.8 22.6-5.6 28.1-16.2 34.4-66.7 19.9-130.1 62-19.1 102.5-49.9 102.5-82.3zm-130.2-66.7c-3.7 12.9-8.3 26.2-13.5 39.5-4.1-8-8.4-16-13.1-24-4.6-8-9.5-15.8-14.4-23.4 14.2 2.1 27.9 4.7 41 7.9zm-45.8 106.5c-7.8 13.5-15.8 26.3-24.1 38.2-14.9 1.3-30 2-45.2 2-15.1 0-30.2-.7-45-1.9-8.3-11.9-16.4-24.6-24.2-38-7.6-13.1-14.5-26.4-20.8-39.8 6.2-13.4 13.2-26.8 20.7-39.9 7.8-13.5 15.8-26.3 24.1-38.2 14.9-1.3 30-2 45.2-2 15.1 0 30.2.7 45 1.9 8.3 11.9 16.4 24.6 24.2 38 7.6 13.1 14.5 26.4 20.8 39.8-6.3 13.4-13.2 26.8-20.7 39.9zm32.3-13c5.4 13.4 10 26.8 13.8 39.8-13.1 3.2-26.9 5.9-41.2 8 4.9-7.7 9.8-15.6 14.4-23.7 4.6-8 8.9-16.1 13-24.1zm-101.4 106.7c-9.3-9.6-18.6-20.3-27.8-32 9 .4 18.2.7 27.5.7 9.4 0 18.7-.2 27.8-.7-9 11.7-18.3 22.4-27.5 32zm-74.4-58.9c-14.2-2.1-27.9-4.7-41-7.9 3.7-12.9 8.3-26.2 13.5-39.5 4.1 8 8.4 16 13.1 24s9.5 15.8 14.4 23.4zm73.9-208.1c9.3 9.6 18.6 20.3 27.8 32-9-.4-18.2-.7-27.5-.7-9.4 0-18.7.2-27.8.7 9-11.7 18.3-22.4 27.5-32zm-74 58.9c-4.9 7.7-9.8 15.6-14.4 23.7-4.6 8-8.9 16-13 24-5.4-13.4-10-26.8-13.8-39.8 13.1-3.1 26.9-5.8 41.2-7.9zm-90.5 125.2c-35.4-15.1-58.3-34.9-58.3-50.6s22.9-35.6 58.3-50.6c8.6-3.7 18-7 27.7-10.1 5.7 19.6 13.2 40 22.5 60.9-9.2 20.8-16.6 41.1-22.2 60.6-9.9-3.1-19.3-6.5-28-10.2zm53.8 142.9c-13.6-7.8-19.5-37.5-14.9-75.7 1.1-9.4 2.9-19.3 5.1-29.4 19.6 4.8 41 8.5 63.5 10.9 13.5 18.5 27.5 35.3 41.6 50-32.6 30.3-63.2 46.9-84 46.9-4.5-.1-8.3-1-11.3-2.7zm237.2-76.2c4.7 38.2-1.1 67.9-14.6 75.8-3 1.8-6.9 2.6-11.5 2.6-20.7 0-51.4-16.5-84-46.6 14-14.7 28-31.4 41.3-49.9 22.6-2.4 44-6.1 63.6-11 2.3 10.1 4.1 19.8 5.2 29.1zm38.5-66.7c-8.6 3.7-18 7-27.7 10.1-5.7-19.6-13.2-40-22.5-60.9 9.2-20.8 16.6-41.1 22.2-60.6 9.9 3.1 19.3 6.5 28.1 10.2 35.4 15.1 58.3 34.9 58.3 50.6-.1 15.7-23 35.6-58.4 50.6z"/>
                                                    <circle cx="420.9" cy="296.5" r="45.7"/>
                                                </g>
                                            </svg>
                                        </div>
                                        <div style="cursor: not-allowed;">
                                            <div class="font-semibold text-[var(--primary-text)]" style="cursor: not-allowed;">React + Vite</div>
                                            <div class="text-xs text-[var(--secondary-text)]" style="cursor: not-allowed;">Coming soon...</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- GitHub Authentication Status -->
                        <div id="github-auth-section" class="mb-6">
                            <div class="flex items-center justify-between p-4 bg-[var(--secondary-bg)] rounded-lg">
                                <div class="flex items-center gap-3 flex-1">
                                    <svg class="w-6 h-6 text-[var(--secondary-text)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                                        <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                                    </svg>
                                    <span class="text-[var(--primary-text)]" id="github-status-text">Not connected</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button onclick="window.downloadOptionsHandler.disconnectGitHub()" id="github-disconnect-button" class="hidden px-3 py-1.5 text-sm text-[var(--secondary-text)] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all hover:underline">
                                        Disconnect
                                    </button>
                                    <button onclick="window.downloadOptionsHandler.authenticateGitHub()" id="github-auth-button" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-sm font-medium">
                                        Connect GitHub
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Repository Selection (Hidden until authenticated) -->
                        <div id="github-repo-section" class="mb-6 hidden">
                            <label class="block text-sm font-medium text-[var(--primary-text)] mb-2">Repository</label>
                            <div class="flex gap-3 mb-4">
                                <div class="flex-1 flex items-center border border-[var(--border-color)] rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 overflow-hidden">
                                    <span id="github-username-prefix" class="px-4 py-3 bg-[var(--secondary-bg)] text-[var(--secondary-text)] border-r border-[var(--border-color)] whitespace-nowrap">username/</span>
                                    <input type="text" id="github-repo-name" placeholder="repository-name" class="flex-1 px-4 py-3 border-0 focus:outline-none focus:ring-0 bg-[var(--primary-bg)] text-[var(--primary-text)]">
                                </div>
                                <select id="github-branch" class="px-4 py-3 border border-[var(--border-color)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[var(--primary-bg)] text-[var(--primary-text)]">
                                    <option value="main">main</option>
                                    <option value="master">master</option>
                                    <option value="gh-pages">gh-pages</option>
                                </select>
                            </div>

                            <!-- Public/Private Toggle -->
                            <div class="flex items-center justify-between p-4 bg-[var(--secondary-bg)] rounded-lg mb-2">
                                <div class="flex items-center gap-3">
                                    <svg class="w-5 h-5 text-[var(--secondary-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                                    </svg>
                                    <div>
                                        <div class="font-medium text-[var(--primary-text)]" id="github-privacy-label">Public Repository</div>
                                        <div class="text-xs text-[var(--secondary-text)]" id="github-privacy-description">Anyone can see this repository</div>
                                    </div>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="github-private-toggle" class="sr-only peer">
                                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            <p class="text-xs text-[var(--secondary-text)] mt-2">Repository will be created if it doesn't exist</p>
                        </div>

                        <!-- Action Buttons (only for GitHub tab) -->
                        <div class="flex gap-3">
                            <button onclick="window.downloadOptionsHandler.closeModal()" class="flex-1 py-3 px-4 bg-[var(--accent-bg)] hover:bg-gray-700 hover:text-white text-[var(--primary-text)] rounded-xl transition-all font-medium">
                                Cancel
                            </button>
                            <button onclick="window.downloadOptionsHandler.pushToGitHub()" id="github-push-button" disabled class="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl transition-all font-medium" style="cursor: not-allowed; opacity: 0.5;">
                                Push to GitHub
                            </button>
                        </div>
                    </div>

                    <!-- Cancel Button (shows in Download tab only) -->
                    <button onclick="window.downloadOptionsHandler.closeModal()" id="cancel-download-button" class="mt-6 w-full py-3 px-4 bg-[var(--accent-bg)] hover:bg-gray-700 hover:text-white text-[var(--primary-text)] rounded-xl transition-all font-medium">
                        Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('download-options-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Initialize with Download tab active
        this.currentTab = 'download';
        
        // Reset success flag when opening modal fresh
        this.successShown = false;

        // Check if user is already authenticated (for GitHub tab)
        this.checkGitHubAuth();

        // Setup privacy toggle handler
        this.setupPrivacyToggle();

        // Setup export format selection styling
        this.setupFormatSelectionStyling();

        // Close on background click
        const modal = document.getElementById('download-options-modal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    /**
     * Setup privacy toggle handler
     */
    setupPrivacyToggle() {
        const toggle = document.getElementById('github-private-toggle');
        const label = document.getElementById('github-privacy-label');
        const description = document.getElementById('github-privacy-description');
        
        if (!toggle) return;
        
        toggle.addEventListener('change', function() {
            if (this.checked) {
                // Private
                label.textContent = 'Private Repository';
                description.textContent = 'Only you can see this repository';
            } else {
                // Public
                label.textContent = 'Public Repository';
                description.textContent = 'Anyone can see this repository';
            }
        });
    }

    /**
     * Setup export format selection styling
     */
    setupFormatSelectionStyling() {
        const formatOptions = document.querySelectorAll('.export-format-option');
        
        // Function to update styling
        const updateSelection = () => {
            formatOptions.forEach(option => {
                const radio = option.querySelector('input[type="radio"]');
                if (radio && radio.checked) {
                    option.classList.add('border-blue-600', 'bg-[var(--accent-bg)]');
                    option.classList.remove('border-gray-200');
                } else {
                    option.classList.remove('border-blue-600', 'bg-[var(--accent-bg)]');
                    option.classList.add('border-gray-200');
                }
            });
        };
        
        // Initial styling
        updateSelection();
        
        // Add change listeners
        formatOptions.forEach(option => {
            const radio = option.querySelector('input[type="radio"]');
            if (radio) {
                radio.addEventListener('change', updateSelection);
            }
        });
    }

    /**
     * Disable GitHub tab (for non-pro users or errors)
     */
    disableGitHubTab() {
        const tabGithub = document.getElementById('tab-github');
        const contentGithub = document.getElementById('content-github');
        
        if (tabGithub) {
            // Disable the tab button
            tabGithub.disabled = true;
            tabGithub.style.opacity = '0.5';
            tabGithub.style.cursor = 'not-allowed';
            
            // Update the onclick to show upgrade modal instead
            tabGithub.onclick = (e) => {
                e.preventDefault();
                this.showUpgradeModal();
            };
            
            // Add a Pro badge to the tab
            if (!tabGithub.querySelector('.pro-badge')) {
                const badge = document.createElement('span');
                badge.className = 'pro-badge ml-2 bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full font-semibold';
                badge.textContent = 'PRO';
                tabGithub.appendChild(badge);
            }
        }
    }

    /**
     * Switch between tabs
     */
    switchTab(tabName) {
        // Check if GitHub tab is disabled
        const tabGithub = document.getElementById('tab-github');
        if (tabName === 'github' && tabGithub && tabGithub.disabled) {
            // Show upgrade modal instead
            this.showUpgradeModal();
            return;
        }
        
        this.currentTab = tabName;
        
        // Update tab buttons
        const tabDownload = document.getElementById('tab-download');
        const contentDownload = document.getElementById('content-download');
        const contentGithub = document.getElementById('content-github');
        const cancelButton = document.getElementById('cancel-download-button');
        
        if (tabName === 'download') {
            // Activate Download tab
            tabDownload.className = 'flex-1 py-3 px-6 rounded-lg font-semibold transition-all bg-[var(--primary-bg)] text-[var(--primary-text)] shadow-sm';
            tabGithub.className = 'flex-1 py-3 px-6 rounded-lg font-semibold transition-all text-[var(--secondary-text)] hover:text-[var(--primary-text)]';
            contentDownload.classList.remove('hidden');
            contentGithub.classList.add('hidden');
            cancelButton.classList.remove('hidden');
        } else {
            // Activate GitHub tab
            tabGithub.className = 'flex-1 py-3 px-6 rounded-lg font-semibold transition-all bg-[var(--primary-bg)] text-[var(--primary-text)] shadow-sm';
            tabDownload.className = 'flex-1 py-3 px-6 rounded-lg font-semibold transition-all text-[var(--secondary-text)] hover:text-[var(--primary-text)]';
            contentGithub.classList.remove('hidden');
            contentDownload.classList.add('hidden');
            cancelButton.classList.add('hidden');
        }
    }

    /**
     * Close the download options modal
     */
    closeModal() {
        const modal = document.getElementById('download-options-modal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Export as HTML (existing functionality)
     */
    exportHTML() {
        this.closeModal();
        
        // Call the existing download function
        if (typeof downloadPage === 'function') {
            downloadPage();
        } else {
            console.error('downloadPage function not found');
        }
    }

    /**
     * Export as React project
     */
    exportReact() {
        this.closeModal();
        
        // Show loading indicator
        this.showLoadingIndicator('Generating React project...');
        
        // Get sections data from iframe
        const iframe = document.getElementById('preview-iframe');
        
        if (!iframe) {
            this.hideLoadingIndicator();
            alert('Preview iframe not found. Please try again.');
            return;
        }
        
        // Get toggle states from global scope (same way as HTML export does)
        // These variables are defined in app.php script
        const fullpageEnabledValue = typeof fullpageEnabled !== 'undefined' ? fullpageEnabled : false;
        const animationsEnabledValue = typeof animationsEnabled !== 'undefined' ? animationsEnabled : false;
        
        console.log('[exportReact] Toggle states:', {
            fullpageEnabled: fullpageEnabledValue,
            animationsEnabled: animationsEnabledValue
        });
        
        // Request sections data from iframe with toggle states
        iframe.contentWindow.postMessage({
            type: 'GET_SECTIONS_DATA',
            data: {
                requestId: 'react_export_' + Date.now(),
                forReactExport: true,
                fullpageEnabled: fullpageEnabledValue,
                animationsEnabled: animationsEnabledValue
            }
        }, '*');
    }

    /**
     * Check GitHub authentication status
     */
    async checkGitHubAuth() {
        try {
            const response = await fetch('api/github-auth-status.php');
            const data = await response.json();
            
            // Check if user needs to upgrade
            if (data.requiresUpgrade) {
                // Disable GitHub tab - user needs to upgrade
                this.disableGitHubTab();
                return;
            }
            
            if (data.authenticated) {
                this.updateGitHubAuthUI(true, data.username);
            }
        } catch (error) {
            console.error('Failed to check GitHub auth status:', error);
            // Disable GitHub tab on error
            this.disableGitHubTab();
        }
    }

    /**
     * Update GitHub auth UI
     */
    updateGitHubAuthUI(authenticated, username = '') {
        const statusText = document.getElementById('github-status-text');
        const authButton = document.getElementById('github-auth-button');
        const disconnectButton = document.getElementById('github-disconnect-button');
        const repoSection = document.getElementById('github-repo-section');
        const pushButton = document.getElementById('github-push-button');
        const repoInput = document.getElementById('github-repo-name');
        const usernamePrefix = document.getElementById('github-username-prefix');

        if (authenticated) {
            // Store the username for later use
            this.githubUsername = username;
            
            statusText.textContent = `Connected as ${username}`;
            statusText.classList.add('text-green-600', 'font-medium');
            authButton.classList.add('hidden');
            disconnectButton.classList.remove('hidden');
            repoSection.classList.remove('hidden');
            pushButton.disabled = false;
            // Enable button styling
            pushButton.style.cursor = 'pointer';
            pushButton.style.opacity = '1';
            
            // Set the username prefix
            if (usernamePrefix) {
                usernamePrefix.textContent = `${username}/`;
            }
        } else {
            this.githubUsername = '';
            statusText.textContent = 'Not connected';
            statusText.classList.remove('text-green-600', 'font-medium');
            authButton.classList.remove('hidden');
            disconnectButton.classList.add('hidden');
            repoSection.classList.add('hidden');
            pushButton.disabled = true;
            // Disable button styling
            pushButton.style.cursor = 'not-allowed';
            pushButton.style.opacity = '0.5';
            
            // Reset prefix and input
            if (usernamePrefix) {
                usernamePrefix.textContent = 'username/';
            }
            if (repoInput) {
                repoInput.value = '';
            }
        }
    }

    /**
     * Authenticate with GitHub
     */
    authenticateGitHub() {
        // Open GitHub OAuth popup
        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        
        const popup = window.open(
            'api/github-oauth.php',
            'github-auth',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        // Listen for authentication success
        const checkAuth = setInterval(() => {
            if (popup.closed) {
                clearInterval(checkAuth);
                this.checkGitHubAuth();
            }
        }, 500);
    }

    /**
     * Disconnect from GitHub
     */
    async disconnectGitHub() {
        try {
            await fetch('api/github-disconnect.php', { method: 'POST' });
            this.updateGitHubAuthUI(false);
        } catch (error) {
            console.error('Failed to disconnect GitHub:', error);
        }
    }

    /**
     * Push project to GitHub
     */
    async pushToGitHub() {
        const format = document.querySelector('input[name="github-format"]:checked').value;
        const repoNameOnly = document.getElementById('github-repo-name').value.trim();
        const branch = document.getElementById('github-branch').value;
        const isPrivate = document.getElementById('github-private-toggle').checked;

        if (!repoNameOnly) {
            alert('Please enter a repository name');
            return;
        }

        // Combine username with repository name
        const repoName = `${this.githubUsername}/${repoNameOnly}`;

        this.closeModal();
        this.showLoadingIndicator('Preparing files for GitHub...');

        try {
            // Get sections data from iframe
            const iframe = document.getElementById('preview-iframe');
            
            if (!iframe) {
                throw new Error('Preview iframe not found');
            }

            // Store the export configuration for later use
            this.githubExportConfig = { format, repoName, branch, isPrivate };

            // Get toggle states and settings from global scope (defined in app.php)
            const fullpageEnabledValue = typeof fullpageEnabled !== 'undefined' ? fullpageEnabled : false;
            const animationsEnabledValue = typeof animationsEnabled !== 'undefined' ? animationsEnabled : false;
            const animateBackgroundsEnabledValue = typeof animateBackgroundsEnabled !== 'undefined' ? animateBackgroundsEnabled : false;
            const fullpageSettingsValue = typeof fullpageSettings !== 'undefined' ? fullpageSettings : {};

            // Request sections data from iframe
            iframe.contentWindow.postMessage({
                type: 'GET_SECTIONS_DATA',
                data: {
                    requestId: 'github_export_' + Date.now(),
                    forGitHubExport: true,
                    format: format,
                    fullpageEnabled: fullpageEnabledValue,
                    animationsEnabled: animationsEnabledValue,
                    animateBackgroundsEnabled: animateBackgroundsEnabledValue,
                    fullpageSettings: fullpageSettingsValue
                }
            }, '*');

        } catch (error) {
            this.hideLoadingIndicator();
            console.error('GitHub push failed:', error);
            alert('Failed to push to GitHub: ' + error.message);
        }
    }

    /**
     * Push generated project to GitHub repository
     */
    async pushProjectToGitHub(data) {
        try {
            const { format, repoName, branch, isPrivate } = this.githubExportConfig || {};
            
            if (!format || !repoName || !branch) {
                throw new Error('GitHub export configuration missing');
            }

            this.updateLoadingMessage('Generating project files...');

            let files;
            
            if (format === 'html') {
                // Generate HTML project using same logic as download
                const response = await fetch('api/generate-html-project.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sections: data.sections,
                        theme: data.theme,
                        templateId: data.templateId || null,
                        fullpageEnabled: data.fullpageEnabled || 'false',
                        fullpageSettings: data.fullpageSettings || {},
                        animationsEnabled: data.animationsEnabled || 'false',
                        animateBackgroundsEnabled: data.animateBackgroundsEnabled || 'false',
                        projectName: repoName.split('/')[1] || 'fpstudio-website',
                        isPaid: window.serverUserData?.is_paid || false
                    })
                });
                
                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error || 'Failed to generate HTML project');
                }
                
                files = result.files;
            } else {
                // Generate React project
                const response = await fetch('api/generate-react-project.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sections: data.sections,
                        theme: data.theme,
                        // Ensure string values for PHP comparison
                        fullpageEnabled: data.fullpageEnabled === 'true' || data.fullpageEnabled === true ? 'true' : 'false',
                        fullpageSettings: data.fullpageSettings || {},
                        animationsEnabled: data.animationsEnabled === 'true' || data.animationsEnabled === true ? 'true' : 'false',
                        projectName: repoName.split('/')[1] || 'fpstudio-app'
                    })
                });
                
                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error || 'Failed to generate React project');
                }
                
                files = result.files;
            }

            this.updateLoadingMessage('Pushing to GitHub...');

            // Push to GitHub
            const pushResponse = await fetch('api/github-push.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repoName,
                    branch,
                    files,
                    isPrivate: isPrivate || false,
                    commitMessage: `Deploy ${format.toUpperCase()} project from FPStudio`
                })
            });

            const pushResult = await pushResponse.json();
            
            if (!pushResult.success) {
                // Check if this is a subscription/upgrade error
                if (pushResult.requiresUpgrade) {
                    this.hideLoadingIndicator();
                    await this.showUpgradeModal();
                    return;
                }
                throw new Error(pushResult.error || 'Failed to push to GitHub');
            }

            this.hideLoadingIndicator();
            this.showGitHubSuccessMessage(pushResult.repoUrl);

        } catch (error) {
            this.hideLoadingIndicator();
            console.error('GitHub push failed:', error);
            
            // Check if error response has requiresUpgrade flag
            if (error.requiresUpgrade) {
                await this.showUpgradeModal();
            } else {
                alert('Failed to push to GitHub: ' + error.message);
            }
        }
    }

    /**
     * Update loading message
     */
    updateLoadingMessage(message) {
        const loader = document.getElementById('download-loading');
        if (loader) {
            const messageEl = loader.querySelector('p.text-gray-700');
            if (messageEl) {
                messageEl.textContent = message;
            }
        }
    }

    /**
     * Show GitHub success message by replacing modal content
     */
    showGitHubSuccessMessage(repoUrl) {
        // Only show success content if not already shown
        if (this.successShown) {
            return;
        }
        
        this.successShown = true;
        
        const modal = document.getElementById('download-options-modal');
        if (!modal) return;
        
        // Find the modal content container
        const modalContent = modal.querySelector('.bg-white');
        if (!modalContent) return;
        
        // Replace content with success message
        modalContent.innerHTML = `
            <div class="p-8 text-center">
                <!-- Success Icon -->
                <div class="mb-6">
                    <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <svg class="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                    </div>
                </div>
                
                <!-- Success Message -->
                <h2 class="text-3xl font-bold text-gray-900 mb-3">Successfully Published!</h2>
                <p class="text-gray-600 mb-6">Your project has been pushed to GitHub</p>
                
                <!-- Repository Link -->
                <a href="${repoUrl}" target="_blank" class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-medium mb-4">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
                        <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    View Repository
                </a>
                
                <!-- Close Button -->
                <button onclick="window.downloadOptionsHandler.closeModal()" class="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all font-medium">
                    Close
                </button>
            </div>
        `;
    }

    /**
     * Generate and download React project
     */
    generateReactProject(data) {
        try {
            const { sections, theme } = data;
            
            // Use toggle states from app.php context (same as HTML export does)
            // Access global variables defined in app.php
            const fullpageEnabledValue = typeof fullpageEnabled !== 'undefined' ? fullpageEnabled : false;
            const animationsEnabledValue = typeof animationsEnabled !== 'undefined' ? animationsEnabled : false;
            
            console.log('=== REACT EXPORT DATA ===');
            console.log('fullpageEnabled (from app.php):', fullpageEnabledValue);
            console.log('animationsEnabled (from app.php):', animationsEnabledValue);
            console.log('sections count:', sections?.length);
            
            const requestPayload = {
                sections: sections,
                theme: theme,
                // Pass boolean values directly (PHP will handle them)
                fullpageEnabled: fullpageEnabledValue,
                animationsEnabled: animationsEnabledValue,
                projectName: 'fpstudio-react-app'
            };
            
            console.log('Request payload:', requestPayload);
            
            // Step 1: Generate React project with HTML to JSX conversion
            fetch('api/generate-react-project.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestPayload)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Server responded with ' + response.status);
                }
                return response.json();
            })
            .then(result => {
                if (!result.success) {
                    throw new Error(result.error || 'Failed to generate project');
                }
                
                // Log any conversion errors (non-fatal)
                if (result.conversionErrors && result.conversionErrors.length > 0) {
                    console.warn('Some sections had conversion issues:', result.conversionErrors);
                }
                
                // Step 2: Send generated files to ZIP creation endpoint
                return fetch('api/download-react-project.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        files: result.files,
                        projectName: result.projectName
                    })
                });
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to create ZIP file');
                }
                return response.blob();
            })
            .then(blob => {
                this.hideLoadingIndicator();
                
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'fpstudio-react-app.zip';
                
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                // Show success message
                this.showSuccessMessage();
            })
            .catch(error => {
                this.hideLoadingIndicator();
                console.error('React export failed:', error);
                alert('React export failed. Please try again.\n\nError: ' + error.message);
            });
            
        } catch (error) {
            this.hideLoadingIndicator();
            console.error('React project generation failed:', error);
            alert('Failed to generate React project. Please try again.');
        }
    }

    /**
     * Show loading indicator (matches modal style)
     */
    showLoadingIndicator(message = 'Processing...') {
        const loader = `
            <style>
                @keyframes github-spinner-spin {
                    to { transform: rotate(360deg); }
                }
                .github-spinner {
                    width: 60px;
                    height: 60px;
                    border: 4px solid rgba(59, 130, 246, 0.1);
                    border-top-color: #3b82f6;
                    border-radius: 50%;
                    animation: github-spinner-spin 0.8s linear infinite;
                    margin: 0 auto;
                }
            </style>
            <div id="download-loading" class="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[10000]" style="display: flex;">
                <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4" onclick="event.stopPropagation()">
                    <div class="p-8 text-center">
                        <div class="mb-6">
                            <div class="github-spinner"></div>
                        </div>
                        <h3 class="text-2xl font-bold text-gray-900 mb-2">${message}</h3>
                        <p class="text-gray-500">This may take a moment...</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', loader);
    }

    /**
     * Hide loading indicator
     */
    hideLoadingIndicator() {
        const loader = document.getElementById('download-loading');
        if (loader) {
            loader.remove();
        }
    }

    /**
     * Show success message (toast notification)
     */
    showSuccessMessage() {
        const message = `
            <div id="download-success" class="fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-[10000] flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                <div>
                    <p class="font-semibold">React project exported successfully!</p>
                    <p class="text-sm opacity-90">Run 'npm install' to get started</p>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', message);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            const successMsg = document.getElementById('download-success');
            if (successMsg) {
                successMsg.style.transition = 'opacity 0.3s';
                successMsg.style.opacity = '0';
                setTimeout(() => successMsg.remove(), 300);
            }
        }, 5000);
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.DownloadOptionsHandler = DownloadOptionsHandler;
    window.downloadOptionsHandler = new DownloadOptionsHandler();
}

