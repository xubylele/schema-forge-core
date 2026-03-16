---
"@xubylele/schema-forge-core": minor
---

✨ feat(validate): add policy validation in schema checks

- Add validation ensuring policies reference existing tables.
- Validate policy commands and require at least one expression (`USING` or `WITH CHECK`).
- Integrate policy validation into the schema validation workflow.
- Add tests covering valid and invalid policy configurations.