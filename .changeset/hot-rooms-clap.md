---
"@xubylele/schema-forge-core": minor
---

✨ feat(sql): add RLS and policy support in SQL parsing and operations

- Add parsing for `ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` statements.
- Extend `applySqlOps` to handle RLS and policy-related operations.
- Update schema rendering to include policies.
- Add tests for parsing and applying RLS and policy operations.
