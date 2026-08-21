// ==UserScript==
// @name         X to XCancel
// @namespace    https://github.com/markhaehnel/userscripts
// @version      1.0.0
// @description  Redirect X and Twitter pages and links to xcancel.com.
// @author       Mark Hähnel
// @homepageURL  https://github.com/markhaehnel/userscripts
// @supportURL   https://github.com/markhaehnel/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/markhaehnel/userscripts/main/x-to-xcancel.user.js
// @downloadURL  https://raw.githubusercontent.com/markhaehnel/userscripts/main/x-to-xcancel.user.js
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

/**
 * Install: Open this .user.js file in Greasemonkey or Tampermonkey.
 * Configuration: Change XCANCEL_BASE below to use another compatible instance.
 * Permissions: All-site access is required to rewrite X/Twitter links anywhere.
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

  // Redirect an X URL entered directly in the address bar.
  const redirectedLocation = xcancelUrl(window.location.href);
  if (redirectedLocation && redirectedLocation !== window.location.href) {
    window.location.replace(redirectedLocation);
    return;
  }

  function isAnchor(node) {
    return (
      node?.nodeType === 1 &&
      node.localName === 'a' &&
      node.hasAttribute('href')
    );
  }

  function rewriteAnchor(anchor) {
    if (!isAnchor(anchor)) {
      return;
    }

    const redirectedHref = xcancelUrl(
      anchor.getAttribute('href'),
      anchor.baseURI || document.baseURI,
    );
    if (redirectedHref) {
      anchor.setAttribute('href', redirectedHref);
    }
  }

  function rewriteTree(node) {
    if (node?.nodeType !== 1) {
      return;
    }

    if (isAnchor(node)) {
      rewriteAnchor(node);
    }

    for (const anchor of node.querySelectorAll('a[href]')) {
      rewriteAnchor(anchor);
    }
  }

  // Rewrite existing and dynamically inserted links, including links in SPAs.
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        rewriteAnchor(mutation.target);
        continue;
      }

      for (const node of mutation.addedNodes) {
        rewriteTree(node);
      }
    }
  });

  observer.observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href'],
  });

  for (const anchor of document.querySelectorAll('a[href]')) {
    rewriteAnchor(anchor);
  }

  // Catch links used before the mutation observer has processed them.
  for (const eventName of ['pointerdown', 'click', 'auxclick', 'contextmenu', 'dragstart']) {
    document.addEventListener(
      eventName,
      (event) => {
        const path = event.composedPath?.() || [event.target];
        const anchor = path.find(isAnchor);
        if (anchor) {
          rewriteAnchor(anchor);
        }
      },
      true,
    );
  }
})();
