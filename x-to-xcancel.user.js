// ==UserScript==
// @name         X to XCancel
// @namespace    https://github.com/markhaehnel/userscripts
// @version      1.1.0
// @description  Redirect X and Twitter pages to xcancel.com.
// @author       Mark Hähnel
// @license      MIT
// @homepageURL  https://github.com/markhaehnel/userscripts
// @supportURL   https://github.com/markhaehnel/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/markhaehnel/userscripts/main/x-to-xcancel.user.js
// @downloadURL  https://raw.githubusercontent.com/markhaehnel/userscripts/main/x-to-xcancel.user.js
// @match        *://x.com/*
// @match        *://www.x.com/*
// @match        *://m.x.com/*
// @match        *://mobile.x.com/*
// @match        *://twitter.com/*
// @match        *://www.twitter.com/*
// @match        *://m.twitter.com/*
// @match        *://mobile.twitter.com/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

/**
 * Install: Open this .user.js file in Greasemonkey or Tampermonkey.
 * Configuration: Change XCANCEL_BASE below to use another compatible instance.
 * Permissions: Runs only on the exact X and Twitter hosts listed above.
 * Supported inputs: The exact X and legacy Twitter hosts listed below.
 * Limitations: t.co links are not resolved because that requires a network
 * request, and the configured XCancel instance may be independently unavailable.
 */
(function () {
  'use strict';

  const XCANCEL_BASE = 'https://xcancel.com/';
  const X_FRONTEND_HOSTS = new Set([
    'x.com',
    'www.x.com',
    'm.x.com',
    'mobile.x.com',
    'twitter.com',
    'www.twitter.com',
    'm.twitter.com',
    'mobile.twitter.com',
  ]);

  function xcancelUrl(value, base = window.location.href) {
    let source;

    try {
      source = new URL(value, base);
    } catch {
      return null;
    }

    if (source.protocol !== 'http:' && source.protocol !== 'https:') {
      return null;
    }

    const hostname = source.hostname.toLowerCase().replace(/\.$/, '');
    if (!X_FRONTEND_HOSTS.has(hostname)) {
      return null;
    }

    const destination = new URL(XCANCEL_BASE);
    destination.pathname = source.pathname;
    destination.search = source.search;
    destination.hash = source.hash;
    return destination.href;
  }

  // Redirect a directly visited X or Twitter URL.
  const redirectedLocation = xcancelUrl(window.location.href);
  if (redirectedLocation && redirectedLocation !== window.location.href) {
    window.location.replace(redirectedLocation);
  }
})();
