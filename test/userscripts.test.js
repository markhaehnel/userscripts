'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const REPOSITORY_URL = 'https://github.com/markhaehnel/userscripts';
const RAW_BASE_URL = 'https://raw.githubusercontent.com/markhaehnel/userscripts/main';

const scripts = [
  {
    filename: 'reddit-to-redlib.user.js',
    name: 'Reddit to Redlib',
    directUrl: 'https://www.reddit.com/r/javascript/comments/abc123/a_title/?context=3#reply',
    directDestination:
      'https://redlib-1.privadency.com/r/javascript/comments/abc123/a_title/?context=3#reply',
    linkUrl: 'https://old.reddit.com/r/node/comments/xyz789/post/?sort=new#comment',
    linkDestination:
      'https://redlib-1.privadency.com/r/node/comments/xyz789/post/?sort=new#comment',
    destinationOrigin: 'https://redlib-1.privadency.com',
    frontendPath: '/r/example/comments/abc123/title?context=2#reply',
    frontendHosts: [
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
    ],
    lookalikeUrls: [
      'https://reddit.com.example.test/r/privacy',
      'https://notreddit.com/r/privacy',
      'ftp://reddit.com/r/privacy',
      'mailto:help@reddit.com',
    ],
  },
  {
    filename: 'x-to-xcancel.user.js',
    name: 'X to XCancel',
    directUrl: 'https://x.com/OpenAI/status/1234567890?s=20#replies',
    directDestination: 'https://xcancel.com/OpenAI/status/1234567890?s=20#replies',
    linkUrl: 'https://mobile.x.com/example/status/987654321?lang=en#media',
    linkDestination: 'https://xcancel.com/example/status/987654321?lang=en#media',
    destinationOrigin: 'https://xcancel.com',
    frontendPath: '/example/status/123456789?lang=en#media',
    frontendHosts: [
      'x.com',
      'www.x.com',
      'm.x.com',
      'mobile.x.com',
      'twitter.com',
      'www.twitter.com',
      'm.twitter.com',
      'mobile.twitter.com',
    ],
    lookalikeUrls: [
      'https://x.com.example.test/example/status/1',
      'https://notx.com/example/status/1',
      'https://twitter.example/example/status/1',
      'ftp://x.com/example/status/1',
      'mailto:help@x.com',
    ],
  },
];

function sourceFor(filename) {
  return readFileSync(path.join(ROOT, filename), 'utf8');
}

function metadataFor(source) {
  const block = source.match(
    /^\/\/ ==UserScript==\s*$([\s\S]*?)^\/\/ ==\/UserScript==\s*$/m,
  );
  assert.ok(block, 'script has a complete userscript metadata block');

  const metadata = new Map();
  for (const line of block[1].split(/\r?\n/)) {
    const directive = line.match(/^\/\/\s+@(\S+)(?:\s+(.*))?$/);
    if (!directive) {
      continue;
    }

    const [, key, rawValue = ''] = directive;
    const values = metadata.get(key) || [];
    values.push(rawValue.trim());
    metadata.set(key, values);
  }

  return metadata;
}

function onlyMetadataValue(metadata, key) {
  assert.ok(metadata.has(key), `metadata includes @${key}`);
  const values = metadata.get(key);
  assert.equal(values.length, 1, `metadata has exactly one @${key}`);
  return values[0];
}

function createBrowser(pageUrl, initialHrefs = []) {
  const observers = [];
  const listeners = new Map();

  const location = {
    href: new URL(pageUrl).href,
    replacements: [],
    replace(url) {
      const resolved = new URL(url, this.href).href;
      this.replacements.push(resolved);
      this.href = resolved;
    },
  };

  function descendantsMatching(element, selector) {
    assert.equal(selector, 'a[href]', 'script uses the expected selector');
    const matches = [];

    for (const child of element.children) {
      if (child.matches(selector)) {
        matches.push(child);
      }
      matches.push(...descendantsMatching(child, selector));
    }

    return matches;
  }

  class Element {
    constructor(tagName = 'div') {
      this.tagName = tagName.toUpperCase();
      this.localName = tagName.toLowerCase();
      this.nodeType = 1;
      this.children = [];
      this.attributes = new Map();
    }

    appendChild(child) {
      this.children.push(child);
      return child;
    }

    matches(selector) {
      return selector === 'a[href]' && this.tagName === 'A' && this.hasAttribute('href');
    }

    hasAttribute(name) {
      return this.attributes.has(name);
    }

    getAttribute(name) {
      return this.hasAttribute(name) ? this.attributes.get(name) : null;
    }

    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }

    querySelectorAll(selector) {
      return descendantsMatching(this, selector);
    }

    get baseURI() {
      return location.href;
    }
  }

  class HTMLAnchorElement extends Element {
    constructor(href, hasHref = true) {
      super('a');
      if (hasHref) {
        this.setAttribute('href', href);
      }
    }

    get href() {
      return this.hasAttribute('href')
        ? new URL(this.getAttribute('href'), location.href).href
        : '';
    }

    set href(value) {
      this.setAttribute('href', value);
    }
  }

  const document = {
    baseURI: location.href,
    children: [],
    addEventListener(eventName, listener, capture) {
      assert.equal(capture, true, `${eventName} listener is registered in capture phase`);
      const eventListeners = listeners.get(eventName) || [];
      eventListeners.push(listener);
      listeners.set(eventName, eventListeners);
    },
    querySelectorAll(selector) {
      return descendantsMatching(this, selector);
    },
  };

  class MutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.observations = [];
      observers.push(this);
    }

    observe(target, options) {
      this.observations.push({ target, options });
    }

    disconnect() {
      this.observations.length = 0;
    }
  }

  const initialAnchors = initialHrefs.map((href) => new HTMLAnchorElement(href));
  document.children.push(...initialAnchors);

  function deliverMutation(record) {
    for (const observer of observers) {
      if (observer.observations.length > 0) {
        observer.callback([record]);
      }
    }
  }

  return {
    context: vm.createContext({
      document,
      Element,
      HTMLAnchorElement,
      MutationObserver,
      URL,
      window: { location },
    }),
    document,
    initialAnchors,
    location,
    createAnchor(href, hasHref = true) {
      return new HTMLAnchorElement(href, hasHref);
    },
    createElement(tagName) {
      return new Element(tagName);
    },
    appendDynamically(parent, child) {
      parent.children.push(child);
      deliverMutation({ type: 'childList', target: parent, addedNodes: [child] });
    },
    changeHrefDynamically(anchor, href) {
      anchor.href = href;
      deliverMutation({ type: 'attributes', target: anchor, attributeName: 'href' });
    },
    dispatch(eventName, path) {
      const event = { composedPath: () => path };
      for (const listener of listeners.get(eventName) || []) {
        listener(event);
      }
    },
    observers,
    listeners,
  };
}

function execute(filename, browser) {
  vm.runInContext(sourceFor(filename), browser.context, { filename });
}

for (const script of scripts) {
  test(`${script.filename}: metadata supports direct installation and updates`, () => {
    const metadata = metadataFor(sourceFor(script.filename));
    const expectedRawUrl = `${RAW_BASE_URL}/${script.filename}`;

    assert.equal(onlyMetadataValue(metadata, 'name'), script.name);
    assert.equal(onlyMetadataValue(metadata, 'namespace'), REPOSITORY_URL);
    assert.equal(onlyMetadataValue(metadata, 'version'), '1.0.1');
    assert.ok(onlyMetadataValue(metadata, 'description'), '@description is not empty');
    assert.equal(onlyMetadataValue(metadata, 'author'), 'Mark Hähnel');
    assert.equal(onlyMetadataValue(metadata, 'license'), 'MIT');
    assert.equal(onlyMetadataValue(metadata, 'homepageURL'), REPOSITORY_URL);
    assert.equal(onlyMetadataValue(metadata, 'supportURL'), `${REPOSITORY_URL}/issues`);
    assert.equal(onlyMetadataValue(metadata, 'updateURL'), expectedRawUrl);
    assert.equal(onlyMetadataValue(metadata, 'downloadURL'), expectedRawUrl);
    assert.deepEqual(metadata.get('match'), ['*://*/*']);
    assert.deepEqual(metadata.get('run-at'), ['document-start']);
    assert.deepEqual(metadata.get('grant'), ['none']);
    assert.deepEqual(metadata.get('noframes'), ['']);
  });

  test(`${script.filename}: redirects a directly visited target URL`, () => {
    const browser = createBrowser(script.directUrl);
    execute(script.filename, browser);

    assert.deepEqual(browser.location.replacements, [script.directDestination]);
    assert.equal(browser.observers.length, 0, 'redirect exits before installing observers');
    assert.equal(browser.listeners.size, 0, 'redirect exits before installing listeners');
  });

  test(`${script.filename}: redirects every supported frontend host`, () => {
    for (const host of script.frontendHosts) {
      const browser = createBrowser(`https://${host}${script.frontendPath}`);
      execute(script.filename, browser);

      assert.deepEqual(
        browser.location.replacements,
        [`${script.destinationOrigin}${script.frontendPath}`],
        `redirects ${host}`,
      );
    }
  });

  test(`${script.filename}: rewrites existing links on an arbitrary page`, () => {
    const browser = createBrowser('https://example.test/articles/one', [script.linkUrl]);
    execute(script.filename, browser);

    assert.deepEqual(browser.location.replacements, []);
    assert.equal(browser.initialAnchors[0].href, script.linkDestination);
    assert.equal(browser.observers.length, 1);
    assert.deepEqual(
      JSON.parse(JSON.stringify(browser.observers[0].observations[0].options)),
      {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href'],
      },
    );
  });

  test(`${script.filename}: rewrites generic SVG-style anchors`, () => {
    const browser = createBrowser('https://example.test/articles/one');
    const anchor = browser.createElement('a');
    anchor.setAttribute('href', script.linkUrl);
    browser.document.children.push(anchor);
    execute(script.filename, browser);

    assert.equal(anchor.getAttribute('href'), script.linkDestination);
  });

  test(`${script.filename}: ignores lookalike hosts and unsupported protocols`, () => {
    const browser = createBrowser('https://example.test/', script.lookalikeUrls);
    const originalUrls = browser.initialAnchors.map((anchor) => anchor.href);
    execute(script.filename, browser);

    assert.deepEqual(
      browser.initialAnchors.map((anchor) => anchor.href),
      originalUrls,
    );

    for (const url of script.lookalikeUrls) {
      const directBrowser = createBrowser(url);
      execute(script.filename, directBrowser);
      assert.deepEqual(directBrowser.location.replacements, [], `does not redirect ${url}`);
    }
  });

  test(`${script.filename}: rewrites dynamically inserted and changed links`, () => {
    const browser = createBrowser('https://example.test/feed');
    execute(script.filename, browser);

    const container = browser.createElement('section');
    const insertedAnchor = browser.createAnchor(script.linkUrl);
    container.appendChild(insertedAnchor);
    browser.appendDynamically(browser.document, container);
    assert.equal(insertedAnchor.href, script.linkDestination);

    const changedAnchor = browser.createAnchor('https://example.test/original');
    browser.document.children.push(changedAnchor);
    browser.changeHrefDynamically(changedAnchor, script.linkUrl);
    assert.equal(changedAnchor.href, script.linkDestination);
  });

  test(`${script.filename}: rewrites links synchronously for early interaction events`, () => {
    const browser = createBrowser('https://example.test/feed');
    execute(script.filename, browser);

    for (const eventName of ['pointerdown', 'click', 'auxclick', 'contextmenu', 'dragstart']) {
      const anchor = browser.createAnchor(script.linkUrl);
      const child = browser.createElement('span');
      browser.dispatch(eventName, [child, anchor, browser.document]);
      assert.equal(anchor.href, script.linkDestination, `${eventName} rewrites the link`);
    }
  });
}

test('reddit-to-redlib.user.js: expands redd.it short links and preserves query/hash', () => {
  const browser = createBrowser('https://example.test/', [
    'https://redd.it/AbC_123/?utm_source=share#discussion',
    'http://www.redd.it/xyz789?context=8#comment',
  ]);
  execute('reddit-to-redlib.user.js', browser);

  assert.equal(
    browser.initialAnchors[0].href,
    'https://redlib-1.privadency.com/comments/AbC_123?utm_source=share#discussion',
  );
  assert.equal(
    browser.initialAnchors[1].href,
    'https://redlib-1.privadency.com/comments/xyz789?context=8#comment',
  );

  const directBrowser = createBrowser('https://redd.it/qwe456?share_id=one#replies');
  execute('reddit-to-redlib.user.js', directBrowser);
  assert.deepEqual(directBrowser.location.replacements, [
    'https://redlib-1.privadency.com/comments/qwe456?share_id=one#replies',
  ]);
});

test('x-to-xcancel.user.js: supports legacy Twitter frontend domains', () => {
  const legacyUrls = [
    'https://twitter.com/example/status/1?ref_src=one#replies',
    'https://www.twitter.com/example/status/2?ref_src=two#media',
    'https://mobile.twitter.com/example/status/3?ref_src=three#quote',
    'https://m.twitter.com/example/status/4?ref_src=four#thread',
  ];
  const browser = createBrowser('https://example.test/', legacyUrls);
  execute('x-to-xcancel.user.js', browser);

  assert.deepEqual(
    browser.initialAnchors.map((anchor) => anchor.href),
    [
      'https://xcancel.com/example/status/1?ref_src=one#replies',
      'https://xcancel.com/example/status/2?ref_src=two#media',
      'https://xcancel.com/example/status/3?ref_src=three#quote',
      'https://xcancel.com/example/status/4?ref_src=four#thread',
    ],
  );

  const directBrowser = createBrowser('https://twitter.com/example/status/5?lang=en#replies');
  execute('x-to-xcancel.user.js', directBrowser);
  assert.deepEqual(directBrowser.location.replacements, [
    'https://xcancel.com/example/status/5?lang=en#replies',
  ]);
});
