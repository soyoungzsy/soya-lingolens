# Privacy

Soya LingoLens stores settings, translation history, favorites, learning status, and translation cache in Chrome's local extension storage.

## Data sent to third parties

The default free translation mode sends selected English text to Google Translate's public endpoint. If that request fails, it falls back to MyMemory. Word lookups may be sent to Free Dictionary API.

If OpenAI mode is enabled, selected text and, when permitted in settings, nearby page context are sent directly from the extension to OpenAI using the API key supplied by the user.

The extension does not include analytics, advertising, a proprietary backend, or a developer-operated data collection service.

## Sensitive pages

Do not use the extension on pages containing confidential company information, personal information, financial data, medical data, private email, or other sensitive content. Disable nearby-context sharing when it is not needed.

### Automatic and manual triggers (0.3.1)

Automatic selection, the selection button, and hover share a conservative English-text filter. Chinese-dominant selections, addresses, and code-like text are skipped regardless of the page's `lang`. Independent English words and sentences remain available on Chinese pages. This is a heuristic, not a complete language detector.

Inputs, textareas, inherited `contenteditable` (including empty and `plaintext-only` attributes), ARIA text fields and common web editors do not trigger automatic translation. Selection endpoints, intersecting editor islands, composed event paths and delayed DOM changes are checked. Code blocks are excluded. Custom editors may require additional detection; use **Manual only** or Chrome's site-access controls on sensitive sites. Only top-level pages receive the content script.

Hover sends no prefetch request. A permitted English label must remain under the pointer for three seconds before translation starts. **Manual only** disables both selection UI and hover requests. The older “translate immediately” checkbox controls only whether a valid selection translates immediately or shows a button.

The context menu and Alt+Shift+E are explicit overrides and can send the current selected text, including from an editor. Editor overrides never include surrounding draft text. Password inputs are never read by the shortcut. Empty selections do not reuse earlier selections. Outside editors, optional context contains only non-editable reading text; Chinese-dominant surrounding text falls back to the selected text. Only OpenAI mode sends this additional context to a service. Source page title and URL are stored locally with learning records.

## Local data

Uninstalling the extension or clearing its extension storage deletes locally stored learning records and settings. API keys are stored in `chrome.storage.local`; they are not embedded in the source code.

Translation cache keys include provider, effective model, fast/full mode, exact selected text and the context actually sent (up to 1500 characters). Legacy ambiguous cache entries are not reused. Learning records are identified by text and context, retaining existing IDs, favorites, mastery state and first-seen dates when updating the same sense. No bulk record migration or deletion is performed. The existing 3000-record retention limit still applies to new saves; old senses already overwritten by earlier versions cannot be recovered automatically.

