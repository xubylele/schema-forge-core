---
"@xubylele/schema-forge-core": minor
---

✨ feat(policies): add policy management support in schema state

- Add new types `PolicyCommand`, `PolicyNode`, and `StatePolicy` for policy definitions.
- Extend `Table` and `StateTable` interfaces with optional `policies` property.
- Update `schemaToState` and `createSnapshot` to handle table policies.