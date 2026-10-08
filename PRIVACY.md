# Privacy

Soya LingoLens stores settings, translation history, favorites, learning status, and translation cache in Chrome's local extension storage.

## Data sent to third parties

The default free translation mode sends selected English text to Google Translate's public endpoint. If that request fails, it falls back to MyMemory. Word lookups may be sent to Free Dictionary API.

If OpenAI mode is enabled, selected text and, when permitted in settings, nearby page context are sent directly from the extension to OpenAI using the API key supplied by the user.

The extension does not include analytics, advertising, a proprietary backend, or a developer-operated data collection service.

## Sensitive pages

Do not use the extension on pages containing confidential company information, personal information, financial data, medical data, private email, or other sensitive content. Disable nearby-context sharing when it is not needed.

## Local data

Uninstalling the extension or clearing its extension storage deletes locally stored learning records and settings. API keys are stored in `chrome.storage.local`; they are not embedded in the source code.

