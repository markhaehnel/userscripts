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
    destinationOrigin: 'https://redlib-1.privadency.com',
    frontendPath: '/r/example/comments/abc123/title?context=2#reply',
    matchHosts: [
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
      'redd.it',
      'www.redd.it',
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
    destinationOrigin: 'https://xcancel.com',
    frontendPath: '/example/status/123456789?lang=en#media',
    matchHosts: [
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

function createBrowser(pageUrl) {
  const location = {
    href: new URL(pageUrl).href,
    replacements: [],
    replace(url) {
      const resolved = new URL(url, this.href).href;
      this.replacements.push(resolved);
      this.href = resolved;
    },
  };

  return {
    context: vm.createContext({ URL, window: { location } }),
    location,
  };
}

function execute(filename, browser) {
  vm.runInContext(sourceFor(filename), browser.context, { filename });
}

for (const script of scripts) {
  test(`${script.filename}: metadata limits execution to supported hosts`, () => {
    const metadata = metadataFor(sourceFor(script.filename));
    const expectedRawUrl = `${RAW_BASE_URL}/${script.filename}`;
    const expectedMatches = script.matchHosts.map((host) => `*://${host}/*`);

    assert.equal(onlyMetadataValue(metadata, 'name'), script.name);
    assert.equal(onlyMetadataValue(metadata, 'namespace'), REPOSITORY_URL);
    assert.equal(onlyMetadataValue(metadata, 'version'), '1.1.0');
    assert.ok(onlyMetadataValue(metadata, 'description'), '@description is not empty');
    assert.equal(onlyMetadataValue(metadata, 'author'), 'Mark Hähnel');
    assert.equal(onlyMetadataValue(metadata, 'license'), 'MIT');
    assert.equal(onlyMetadataValue(metadata, 'homepageURL'), REPOSITORY_URL);
    assert.equal(onlyMetadataValue(metadata, 'supportURL'), `${REPOSITORY_URL}/issues`);
    assert.equal(onlyMetadataValue(metadata, 'updateURL'), expectedRawUrl);
    assert.equal(onlyMetadataValue(metadata, 'downloadURL'), expectedRawUrl);
    assert.deepEqual(metadata.get('match'), expectedMatches);
    assert.ok(!metadata.get('match').includes('*://*/*'));
    assert.deepEqual(metadata.get('run-at'), ['document-start']);
    assert.deepEqual(metadata.get('grant'), ['none']);
    assert.deepEqual(metadata.get('noframes'), ['']);
  });

  test(`${script.filename}: redirects a directly visited target URL`, () => {
    const browser = createBrowser(script.directUrl);
    execute(script.filename, browser);

    assert.deepEqual(browser.location.replacements, [script.directDestination]);
  });

  test(`${script.filename}: redirects every matched host over HTTP and HTTPS`, () => {
    for (const scheme of ['http', 'https']) {
      for (const host of script.matchHosts) {
        const browser = createBrowser(`${scheme}://${host}${script.frontendPath}`);
        execute(script.filename, browser);

        assert.deepEqual(
          browser.location.replacements,
          [`${script.destinationOrigin}${script.frontendPath}`],
          `redirects ${scheme}://${host}`,
        );
      }
    }
  });

  test(`${script.filename}: ignores unrelated hosts and unsupported protocols`, () => {
    for (const url of script.lookalikeUrls) {
      const browser = createBrowser(url);
      execute(script.filename, browser);
      assert.deepEqual(browser.location.replacements, [], `does not redirect ${url}`);
    }
  });
}

test('reddit-to-redlib.user.js: expands redd.it IDs and preserves query/hash', () => {
  const cases = [
    {
      source: 'https://redd.it/AbC_123/?utm_source=share#discussion',
      destination:
        'https://redlib-1.privadency.com/comments/AbC_123?utm_source=share#discussion',
    },
    {
      source: 'http://www.redd.it/xyz789?context=8#comment',
      destination: 'https://redlib-1.privadency.com/comments/xyz789?context=8#comment',
    },
  ];

  for (const { source, destination } of cases) {
    const browser = createBrowser(source);
    execute('reddit-to-redlib.user.js', browser);
    assert.deepEqual(browser.location.replacements, [destination]);
  }
});
