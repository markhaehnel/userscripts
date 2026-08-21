# Repository Guidelines

## Project Structure & Module Organization

Place each standalone userscript at the repository root using the
`kebab-case.user.js` naming pattern. A `.user.js` file is both source code and
the published artifact; do not create generated or bundled copies. Shared
checks belong in `test/*.test.js`. Keep `package.json` limited to repository-wide
development commands.

Each userscript must contain its own documentation. Use the metadata block and
inline comments to explain its purpose, supported sites, permissions,
configuration values, and important limitations. Do not use separate documents
for per-script installation, configuration, or behavior.

## Build, Test, and Development Commands

- `npm test` runs all metadata and behavior checks with Node's built-in test
  runner.
- `node --check path/to/script.user.js` validates JavaScript syntax without
  executing the script.
- `git diff --check` detects trailing whitespace and malformed patch output.

No dependency installation or build step is required. Edit `.user.js` files
directly.

## Coding Style & Naming Conventions

Use two-space indentation, single-quoted strings, semicolons, and trailing
commas in multiline collections and calls. Name functions and local variables
in `camelCase`; use `UPPER_SNAKE_CASE` for user-configurable constants. Keep the
userscript metadata block at the top of the file and code in a self-contained
IIFE. Prefer browser-native APIs and avoid third-party runtime dependencies.

Use a stable repository namespace. Keep `@name`, `@description`, `@match`,
`@grant`, update URLs, and inline configuration guidance accurate. Increment
`@version` for every published change.

## Testing Guidelines

Tests use `node:test`, strict assertions, `node:vm`, and minimal browser/DOM
fakes. Name test files `test/*.test.js`. Add focused cases for metadata, direct
navigation, existing and dynamically inserted content, interaction events, URL
preservation, supported hosts, deceptive lookalike hosts, and unsupported
protocols as applicable. There is no numeric coverage threshold; every behavior
change needs a regression test and must leave `npm test` passing.

## Commit & Pull Request Guidelines

Use short, imperative commit subjects, such as `Add redirect safety tests`.
Keep unrelated changes separate. Pull requests should describe user-visible
behavior, link relevant issues, list automated and manual tests, and identify
the browsers and userscript managers checked. Explicitly call out new host
permissions, privileged APIs, network requests, or stored data. Screenshots are
only needed when a script produces visible page output.

## Security & Distribution

Request the narrowest practical `@match` and `@grant` permissions. Treat URL
parsing and hostname matching as security boundaries; prefer exact allowlists
and test deceptive domains. Verify that `@downloadURL` and `@updateURL` point to
the script's public raw file before publishing.
