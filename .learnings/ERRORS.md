# Errors

## [ERR-20261023-001] browser-regression-runner

**Logged**: 2026-10-23T00:00:00+08:00
**Priority**: medium
**Status**: blocked
**Area**: tests

### Summary
The isolated browser test could not find Playwright's bundled Chromium executable.

### Error
`BrowserType.launch_persistent_context: Failed to launch chromium because executable doesn't exist`

### Context
- Command: `npm run test:browser`
- The Python Playwright package exists, but its matching browser bundle is absent.

### Suggested Fix
Set `LINGOLENS_CHROMIUM` to an existing local Chrome executable; the test still uses an isolated temporary profile and offline routes.

### Metadata
- Reproducible: yes
- Related Files: tests/browser.py

### Resolution
- **Blocked**: 2026-10-23
- **Notes**: Playwright's browser bundle is absent, while the installed Stable Chrome exits immediately in both headed and headless isolated extension runs. Unit and syntax checks remain available; browser acceptance needs a compatible Playwright Chromium installation.

---
