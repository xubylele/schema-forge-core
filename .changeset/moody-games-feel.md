---
"@xubylele/schema-forge-core": minor
---

✨ feature: Add migration plan builder for diff preview operations

- Added a new migration planning layer that transforms diff operations into structured plan entries with deterministic action mapping (+ create/add, ~ modify/change/replace, - drop/delete).
- Introduced formatter helpers to output human-readable migration plan lines without requiring SQL execution.
- Exposed the new planner APIs from core entrypoints and added tests to validate symbol mapping, metadata output, and operation order consistency with the diff engine.
- Updated README "What's New" and documentation with a dedicated Migration Plan Preview section and usage example.
