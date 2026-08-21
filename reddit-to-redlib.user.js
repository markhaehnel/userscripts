// ==UserScript==
// @name         Reddit to Redlib
// @namespace    https://github.com/markhaehnel/userscripts
// @version      1.0.0
// @description  Redirect Reddit pages and links to redlib-1.privadency.com.
// @author       Mark Hähnel
// @homepageURL  https://github.com/markhaehnel/userscripts
// @supportURL   https://github.com/markhaehnel/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/markhaehnel/userscripts/main/reddit-to-redlib.user.js
// @downloadURL  https://raw.githubusercontent.com/markhaehnel/userscripts/main/reddit-to-redlib.user.js
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

/**
 * Install: Open this .user.js file in Greasemonkey or Tampermonkey.
 * Configuration: Change REDLIB_BASE below to use another Redlib instance.
 * Permissions: All-site access is required to rewrite Reddit links anywhere.
 * Supported inputs: The exact Reddit hosts listed below and simple redd.it IDs.
 * Limitations: Opaque share links are forwarded unchanged, and the configured
 * Redlib instance may be unavailable independently of this script.
 */
(function () {
  'use strict';

  const REDLIB_BASE = 'https://redlib-1.privadency.com/';
  const REDDIT_FRONTEND_HOSTS = new Set([
    'reddit.com',
    'www.reddit.com',
    'old.reddit.com',
    'new.reddit.com',
    'np.reddit.com',
    'm.reddit.com',
    'amp.reddit.com',
    'sh.reddit.com',
    'i.reddit.com',
    'pay.reddit.com',
    'ssl.reddit.com',
    'beta.reddit.com',
  ]);
  const REDDIT_SHORTLINK_HOSTS = new Set(['redd.it', 'www.redd.it']);

  function redlibUrl(value, base = window.location.href) {
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
    let pathname = source.pathname;

    if (REDDIT_SHORTLINK_HOSTS.has(hostname)) {
      const match = pathname.match(/^\/([a-z0-9_]+)\/?$/i);
      if (match) {
        pathname = `/comments/${match[1]}`;
      }
    } else if (!REDDIT_FRONTEND_HOSTS.has(hostname)) {
      return null;
    }

    const destination = new URL(REDLIB_BASE);
    destination.pathname = pathname;
    destination.search = source.search;
    destination.hash = source.hash;
    return destination.href;
  }

  // Redirect a Reddit URL entered directly in the address bar.
  const redirectedLocation = redlibUrl(window.location.href);
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

    const redirectedHref = redlibUrl(
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

  // Catch links used before the mutation observer has had a chance to process them.
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
