---
"@xubylele/schema-forge-core": minor
---

✨ feat(policies): enable Row Level Security when generating policy SQL

- Generate SQL to enable Row Level Security (RLS) when creating or modifying policies.
- Ensure RLS is enabled only once per table even when multiple policies exist.
- Add tests verifying correct RLS statement generation during policy operations.