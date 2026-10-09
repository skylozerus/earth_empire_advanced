// ==UserScript==
// @name         Earth Empires – Tab Title Enhancer & Scroller
// @namespace    https://github.com/skylozerus/earth_empire_advanced
// @version      1.0
// @description  Enhances webpage title with server name (first path segment) and H1 heading, scrolling the title if it exceeds tab width.
// @author       skylozerus
// @match        https://*.earthempires.com/*
// @match        https://earthempires.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Store the original document title as fallback
    const originalTitle = document.title;
    let scrollInterval = null;
    let titleBuffer = '';
    let currentServer = '';
    let currentH1 = '';
    let isScrolling = false;

    /**
     * Extracts the server name (first path segment after domain)
     * e.g. https://www.earthempires.com/express/advisor -> 'express'
     */
    function getServerName() {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
            return pathParts[0];
        }
        return window.location.hostname;
    }

    /**
     * Extracts H1 text from page, falling back to H2 or original title
     */
    function getH1Text() {
        const h1 = document.querySelector('h1');
        if (h1 && h1.textContent.trim()) {
            return h1.textContent.trim();
        }
        const h2 = document.querySelector('h2');
        if (h2 && h2.textContent.trim()) {
            return h2.textContent.trim();
        }
        return originalTitle || 'Page';
    }

    /**
     * Updates the base title buffer if server or H1 changed
     */
    function updateTitleBuffer() {
        const server = getServerName();
        const h1 = getH1Text();

        if (server === currentServer && h1 === currentH1 && titleBuffer) {
            return;
        }

        currentServer = server;
        currentH1 = h1;

        const formattedServer = server.toUpperCase();
        const baseTitle = `[${formattedServer}] ${h1}`;

        // Tab threshold length: if longer than 14 characters, enable marquee scrolling
        if (baseTitle.length > 14) {
            titleBuffer = `${baseTitle}   •   `;
            isScrolling = true;
        } else {
            titleBuffer = baseTitle;
            isScrolling = false;
        }
    }

    /**
     * Starts the title scrolling timer loop
     */
    function startTitleManager() {
        if (scrollInterval) {
            clearInterval(scrollInterval);
        }

        updateTitleBuffer();
        document.title = isScrolling ? titleBuffer : currentServer ? `[${currentServer.toUpperCase()}] ${currentH1}` : document.title;

        // Ticker interval: shifts text by removing char at beginning and adding to end
        scrollInterval = setInterval(function() {
            updateTitleBuffer();
            if (!titleBuffer) {
                return;
            }

            if (isScrolling) {
                // Remove character at index 0 and append it to the end
                titleBuffer = titleBuffer.substring(1) + titleBuffer.substring(0, 1);
                document.title = titleBuffer;
            } else {
                document.title = titleBuffer;
            }
        }, 350);
    }

    // Initialize once DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startTitleManager);
    } else {
        startTitleManager();
    }

    // Observe dynamic changes to DOM in case H1 updates dynamically
    const observer = new MutationObserver(function() {
        updateTitleBuffer();
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    }
})();
