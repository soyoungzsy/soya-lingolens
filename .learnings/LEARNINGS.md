# Learnings

## [LRN-20261023-001] correction

**Logged**: 2026-10-23T00:00:00+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
Editing state and programmatic select-all must not be treated as an intentional reading selection.

### Details
Reading `window.getSelection()` after a delay can capture a selection created by a rename/edit click after mouseup. Clicking the translation card's close button can also leave the page selection intact and retrigger the same automatic path.

### Suggested Action
Capture and validate the selection synchronously on mouseup, exclude editable/composed-path targets, and cancel pending automatic work when dismissing the card.

### Metadata
- Source: user_feedback
- Related Files: content.js, trigger-policy.js, tests/browser.py
- Tags: selection, editor, dismissal, regression
- Pattern-Key: harden.selection_intent

### Resolution
- **Resolved**: 2026-10-23
- **Notes**: Added explicit rename/edit and card-dismissal browser regressions; close actions now cancel pending automatic work.

---
