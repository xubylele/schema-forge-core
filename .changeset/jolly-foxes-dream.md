---
"@xubylele/schema-forge-core": minor
---

feat(drift): add schema drift analyzer against state snapshots

- Added `analyzeSchemaDrift(state, liveSchema)` to compare live DB schemas with `state.json`.
- Added structured `DriftReport` output for missing tables, extra tables, column differences, and type mismatches.
- Exported drift analyzer APIs and added focused tests for acceptance criteria and deterministic ordering.
