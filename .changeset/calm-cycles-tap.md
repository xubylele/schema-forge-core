---
"@xubylele/schema-forge-core": minor
---

✨ feat: add support for indexes in schema management

- Introduced IndexNode and StateIndex types to represent indexes in the schema.
- Implemented index creation and deletion operations in the diffSchemas function.
- Enhanced the parser to support index declarations, including unique and expression indexes.
- Added validation for indexes to ensure correct definitions and prevent duplicates.
- Updated SQL generation to include CREATE and DROP INDEX statements.
- Enhanced tests to cover index creation, modification, and validation scenarios.
