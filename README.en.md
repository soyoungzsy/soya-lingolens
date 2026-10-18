# Soya LingoLens

**Select unfamiliar English on a webpage, see a Chinese explanation and save it for review.**

## Start here if you do not code

This adds a small tool to Chrome on a computer. You do not need to write code. Test it with a few unimportant pages first.

1. Open the [fixed release](https://github.com/soyoungzsy/soya-lingolens/releases/tag/v0.4.0) and choose Source code (zip) under Assets.
2. Find the ZIP in your Downloads folder and double-click to extract it. Keep the extracted folder: Chrome needs it later.
3. Type `chrome://extensions` in Chrome’s address bar, press Enter and turn on **Developer mode** at the top right. This is Chrome’s route for installing a local extension; coding knowledge is not required.
4. Click **Load unpacked** and select the extracted folder containing `manifest.json` directly. Choose the folder, not an individual file.
5. Open a public English page and select one English word. Avoid private email or work pages.

**A successful first try:** A Chinese explanation card appears, and the learning record is available in the extension sidebar.

Cannot find the folder? Check that the ZIP is extracted and inspect any extra outer folder. Nothing happens? Confirm the extension is enabled and refresh your test page. To stop, turn the extension off on the same extensions page. This does not restore an older version. Read the data notes below before uninstalling.

The default free translator may send selected text and nearby sentences to an external translation service. Optional paid AI translation needs your own account. Learning-record export is currently unavailable; uninstalling may lose records.

You can skip the configuration and code details below. Use the **Issues** tab above to ask a question publicly; remove private/work information first.



Read English websites without replacing the original text: translate selected words or passages, explain short hovered controls, and retain encountered text for review in a Chrome side panel.

[中文](README.md) · Source version: 0.4.0 · [Privacy](PRIVACY.md) · [Updating](UPDATING.md)

## Why and for whom

Designed for native Chinese speakers learning through X/Twitter, news, blogs and product websites. Whole-page translation hides the original; this extension adds help only where needed. It is not a professional translation service, does not support Firefox/Safari/mobile Chrome or cloud sync, and cannot inject into Chrome internal pages, the Web Store or the built-in PDF viewer. Do not use it on sensitive personal or work pages.

## Install without a development environment

1. On this repository, choose Code → Download ZIP and extract it.
2. Open `chrome://extensions/` and enable Developer mode.
3. Choose Load unpacked and select the directory containing `manifest.json` directly.
4. Confirm Soya LingoLens is enabled, then refresh previously open websites.
5. Click its toolbar icon to open the review side panel.

No build, server or API key is needed for the default mode. This is an unpacked extension, not a Chrome Web Store release. For reproducibility, use a fixed release when one is actually published; current source availability is not evidence that a release exists.

## First use and expected result

On an ordinary public English page, select a word or sentence. Expect a nearby Chinese translation card and a new side-panel record. Hover over a short English link/button for three seconds without clicking to see a compact explanation. Leave early to avoid a request. Right-click or use Alt+Shift+E for explicit translation.

Smart-English mode skips Chinese-dominant selections, editing fields, code and unsupported text. Manual-only mode disables selection and hover requests; explicit commands remain available. Automatic rules are heuristic and may miss custom editors or match non-English Latin text. Scripts run in the top frame, not cross-origin iframes.

The side panel supports search, favorites, deletion, mastery status, speech and source links. Same text/context accumulates encounters; different contexts remain separate. Original timestamps and favorites are retained. Previously overwritten contexts cannot be recovered automatically.

## Costs, providers and data

Default translation uses Google Translate public endpoints with MyMemory fallback; Free Dictionary API provides dictionary details. Common short controls use a local dictionary. These services may fail or rate-limit; no availability SLA is promised.

Optional OpenAI mode needs your API key and model in Settings and incurs your provider's charges. The key is stored in local extension storage, not sent to this project's author. With nearby-context sharing enabled, up to 1,500 characters of nearby English may accompany the selection; editing/code/hidden content is filtered heuristically. Explicit translation inside an editor sends only the selection, but still stores the source title and URL. Free translation requests selected text and related dictionary data, not the surrounding paragraph. Read [PRIVACY.md](PRIVACY.md) before enabling network translation.

`storage`, `sidePanel` and `contextMenus` support local records and UI. Broad HTTP/HTTPS page access enables selection cards; restrict site access in Chrome for sensitive sites. This project has no developer telemetry/backend, but translation text is sent to the configured third-party services. Local records retain source titles/URLs. Up to 3,000 records and 1,000 cached translations are kept; cache lifetime is 30 days. Use the sidebar to export a JSON backup and merge it back after reinstalling or changing computers. There is no automatic cross-device sync. Uninstalling or clearing extension data deletes local records unless you have a saved backup.

## Update, recover and troubleshoot

Back up the current source directory, keep the same loading path and extension ID, replace all files, reload the extension and refresh websites. Do not uninstall or load a new path when preserving data. Code backups do not contain Chrome storage. See [UPDATING.md](UPDATING.md); downgrading may merge multi-context records when old code next writes them.

No card: check mode, site access, supported page type and refresh after installation. Hover requires three seconds on a short English control. Network failure: check access to your selected provider, then its key/model/balance where applicable. Available English speech voices depend on the OS and Chrome.

Development commands: `npm run check`, `npm test`, optional `npm run test:browser`, and `npm run package`. Browser checks require the tooling described in [VALIDATION.md](VALIDATION.md). Prior validation statements in that document are not new test results from this documentation proposal. See [maintenance](MAINTENANCE.md), [contribution rules](CONTRIBUTING.md), [changes](CHANGELOG.md) and [MIT license](LICENSE).

## Sources and acknowledgements

See [sources](SOURCES.md) for original authors, references, dependencies and licenses. AI rewriting does not establish original authorship; required third-party notices remain in applicable downloads.

Backup recovery: export records from the sidebar, then confirm the record count before importing. Existing records and review state win for matching text/context. Imports are limited to 3000 records and 5MB, validated before writing, and preceded by a local backup. Service credentials are not exported.

Version: 0.4.0 · [Release / 固定下载](https://github.com/soyoungzsy/soya-lingolens/releases/tag/v0.4.0)
