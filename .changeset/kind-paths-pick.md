---
"@xubylele/schema-forge-core": minor
---

✨ feat(diff): add policy operations to schema diffing

- Add support for policy creation, modification, and deletion during schema diffing.
- Introduce new operation types: `create_policy`, `modify_policy`, and `drop_policy`.
- Extend `diffSchemas` to detect policy changes between schema states.
- Classify policy operations for safety: `create_policy` (SAFE), `modify_policy` (WARNING), `drop_policy` (DESTRUCTIVE).
- Implement SQL generation for policy operations.
- Add tests covering policy diffing and SQL generation.