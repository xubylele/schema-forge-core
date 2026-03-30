---
"@xubylele/schema-forge-core": minor
---

✨ feat: add support for PostgreSQL views in schema management

- Introduced ViewNode and StateView types to represent views in the schema and persisted state.
- Implemented create_view, drop_view, and replace_view operations in the diffSchemas function.
- Enhanced the parser to support view declarations using the `view <name> as <sql>` syntax.
- Added hash-based comparison for view query bodies to detect changes deterministically.
- Updated SQL generation to emit CREATE OR REPLACE VIEW and DROP VIEW IF EXISTS statements.
- Expanded safety classification and tests to cover view creation, replacement, deletion, and parser/diff/generator behavior.
