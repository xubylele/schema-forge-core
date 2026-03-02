---
"@xubylele/schema-forge-core": minor
---

# ✨ feat(safety): introduce centralized safety middleware layer for destructive operation validation

- Created new `safety/` module to encapsulate safety logic.
- Added `operation-classifier.ts` to classify operations as `SAFE`, `WARNING`, or `DESTRUCTIVE`.
- Added `safety-checker.ts` to evaluate classified operations and produce a structured safety report.
- Ensured all destructive operations pass through the safety middleware before execution.
- Standardized middleware result object (e.g. `{ level, blocked, warnings, operations }`).
- Integrated middleware with CLI command execution flow.
- Added comprehensive unit tests for classification logic, middleware behavior, and edge cases.
