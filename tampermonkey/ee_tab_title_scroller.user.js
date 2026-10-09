// ==UserScript==
// @name         Earth Empires – Tab Title Enhancer & Scroller
// @namespace    https://github.com/skylozerus/earth_empire_advanced
// @version      1.2
// @description  Sets webpage title to [SERVER] EE - [Page] only for recognized server pages, and marquee scrolls the title for tab identification.
// @author       skylozerus
// @match        https://*.earthempires.com/*
// @match        https://earthempires.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Base set of recognized server paths from the server menu
    const DEFAULT_SERVERS = {
        'cooperation': 'COOPERATION',
        'conquest': 'CONQUEST',
        'alliance': 'ALLIANCE',
        'express': 'EXPRESS',
        'primary': 'CLASSIC',
        'ffa': 'FFA',
    };

    const originalTitle = document.title;
    let scrollInterval = null;
    let titleBuffer = '';
    let currentServer = '';
    let currentPage = '';
    let isScrolling = false;

    /**
     * Capitalizes a string (e.g. 'advisor' -> 'Advisor', 'scores_nw' -> 'Scores Nw')
     */
    function capitalize(str) {
        if (!str) {
            return '';
        }
        return str.split(/[-_]/).map(function(word) {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(' ');
    }

    /**
     * Retrieves valid servers, dynamically combining defaults with any found in #servers menu
     */
    function getValidServers() {
        const servers = Object.assign({}, DEFAULT_SERVERS);
        const serverLinks = document.querySelectorAll('#servers .server_name a');

        if (serverLinks.length > 0) {
            serverLinks.forEach(function(link) {
                const href = link.getAttribute('href');
                if (href) {
                    const parts = href.split('/').filter(Boolean);
                    if (parts.length > 0) {
                        const key = parts[0].toLowerCase();
                        servers[key] = key.toUpperCase();
                    }
                }
            });
            try {
                localStorage.setItem('ee_valid_servers', JSON.stringify(Object.keys(servers)));
            } catch {
                // Ignore errors
            }
        } else {
            try {
                const saved = localStorage.getItem('ee_valid_servers');
                if (saved) {
                    const list = JSON.parse(saved);
                    list.forEach(function(s) {
                        servers[s.toLowerCase()] = s.toUpperCase();
                    });
                }
            } catch {
                // Ignore errors
            }
        }
        return servers;
    }

    /**
     * Extracts page name (2nd path segment), falling back to H1 or original title
     */
    function getPageName() {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts.length > 1) {
            return capitalize(pathParts[1]);
        }

        const h1 = document.querySelector('h1');
        if (h1 && h1.textContent.trim()) {
            return capitalize(h1.textContent.trim());
        }
        const h2 = document.querySelector('h2');
        if (h2 && h2.textContent.trim()) {
            return capitalize(h2.textContent.trim());
        }
        return capitalize(originalTitle) || 'Home';
    }

    /**
     * Updates title buffer if URL belongs to a recognized server
     */
    function updateTitleBuffer() {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts.length === 0) {
            return;
        }

        const firstSegment = pathParts[0].toLowerCase();
        const validServers = getValidServers();

        // Only process title enhancement if the URL has a recognized server name
        if (!Object.prototype.hasOwnProperty.call(validServers, firstSegment)) {
            return;
        }

        const serverDisplay = validServers[firstSegment];
        const page = getPageName();

        if (serverDisplay === currentServer && page === currentPage && titleBuffer) {
            return;
        }

        currentServer = serverDisplay;
        currentPage = page;

        const baseTitle = `[${serverDisplay}] ${page} • EE`;

        if (baseTitle.length > 14) {
            titleBuffer = `${baseTitle}  •  `;
            isScrolling = true;
        } else {
            titleBuffer = baseTitle;
            isScrolling = false;
        }
    }

    /**
     * Starts scrolling timer for valid server pages
     */
    function startTitleManager() {
        if (scrollInterval) {
            clearInterval(scrollInterval);
        }

        updateTitleBuffer();

        scrollInterval = setInterval(function() {
            updateTitleBuffer();

            const pathParts = window.location.pathname.split('/').filter(Boolean);
            const firstSegment = pathParts.length > 0 ? pathParts[0].toLowerCase() : '';
            const validServers = getValidServers();

            if (!Object.prototype.hasOwnProperty.call(validServers, firstSegment)) {
                return;
            }

            if (isScrolling && titleBuffer) {
                // Shift: remove first character and append it to end
                titleBuffer = titleBuffer.substring(1) + titleBuffer.substring(0, 1);
                document.title = titleBuffer;
            } else if (titleBuffer) {
                document.title = titleBuffer;
            }
        }, 350);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startTitleManager);
    } else {
        startTitleManager();
    }

    const observer = new MutationObserver(function() {
        updateTitleBuffer();
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    }
})();
