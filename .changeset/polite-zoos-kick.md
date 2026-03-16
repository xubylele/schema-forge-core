---
"@xubylele/schema-forge-core": minor
---

✨ feat(parser): add policy parsing support in schema definitions

- Extend `parseSchema` to support table policy declarations.
- Add `parsePolicyBlock` to parse policy commands and conditions.
- Update table structures to include optional `policies` property.
- Add tests for policy parsing, including validation and duplicate command detection.