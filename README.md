# Userscripts

[![CI](https://github.com/markhaehnel/userscripts/actions/workflows/ci.yml/badge.svg)](https://github.com/markhaehnel/userscripts/actions/workflows/ci.yml)

Small, self-contained redirect userscripts for Greasemonkey and Tampermonkey.
The `.user.js` files in this repository are the installable artifacts; there is
no build step and no runtime dependency.

## Install

Install [Greasemonkey](https://www.greasespot.net/) or
[Tampermonkey](https://www.tampermonkey.net/), then choose a script:

| Script | What it does | Install |
| --- | --- | --- |
| Reddit to Redlib | Redirects Reddit pages and `redd.it` short links to `redlib-1.privadency.com`. | [Install](https://raw.githubusercontent.com/markhaehnel/userscripts/main/reddit-to-redlib.user.js) |
| X to XCancel | Redirects X and legacy Twitter pages to `xcancel.com`. | [Install](https://raw.githubusercontent.com/markhaehnel/userscripts/main/x-to-xcancel.user.js) |

The manager should open an installation prompt when an install link is clicked.
Review the source shown by the manager, then confirm the installation.

These links and automatic updates require this repository's `main` branch to be
publicly accessible. If the repository is private or has not been pushed yet,
open the desired `.user.js` file locally, copy it, create a new script in the
manager dashboard, replace the editor contents, and save.

### Chromium-based browsers

Tampermonkey 5.3 and newer requires one additional browser setting on Chrome,
Edge, and other Chromium-based browsers. Enable **Allow User Scripts** in
Tampermonkey's extension details; if that switch is not available, enable the
browser's extension **Developer mode**. See Tampermonkey's
[permission instructions](https://www.tampermonkey.net/faq.php?locale=en&q=Q209).

## Permissions and behavior

Each script requests access only to its explicitly supported source hosts:
Reddit and `redd.it` frontends, or X and legacy Twitter frontends. They are not
injected into unrelated websites and no longer rewrite outbound links found on
those sites. The scripts do not use privileged userscript APIs, make additional
background requests, or store data. A redirect sends its URL and normal request
metadata to the configured destination as part of standard browser navigation.

Each script also:

- redirects a matching address-bar navigation as early as the manager permits;
- preserves URL paths, query strings, and fragments; and
- runs only in the top-level page, not in embedded frames.

Disable or uninstall a script from the Greasemonkey/Tampermonkey dashboard to
stop its redirects.

Each `.user.js` file documents its own supported sites, configuration,
permissions, and limitations alongside its code. When publishing a change,
increment the script's `@version` so installed copies can detect it.

## Development

Run the dependency-free checks with a current Node.js release:

```sh
npm test
```

The checks validate userscript metadata, JavaScript syntax, redirects, scoped
host access, and URL safety cases. Edit the `.user.js` files directly;
generated copies are intentionally not used.

## License

Released under the [MIT License](LICENSE).
