---
"@xubylele/schema-forge-core": minor
---

✨ feat(policies): add full RLS and policy support across parsing, diffing, and SQL

- Add support for `ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` in SQL parsing.
- Extend `applySqlOps` to handle RLS and policy-related operations.
- Include policies in schema rendering output.
- Add `all` command to apply policies to SELECT, INSERT, UPDATE, and DELETE.
- Support `to` clause for role-based policy definitions.
- Update parsing, validation, and SQL generation to support policy features.
- Improve parsing of `ENABLE ROW LEVEL SECURITY` (whitespace normalization and optional semicolon).
- Add comprehensive tests covering parsing, validation, SQL generation, and edge cases.