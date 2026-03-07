---
"@xubylele/schema-forge-core": patch
---

♻️ chore(core): update dependencies and refactor state management

- Add `tsup` as a dev dependency for building browser-compatible bundles.
- Update `package.json` scripts to include a browser build step.
- Refactor `schemaToState` to export from `state-transform.js`, simplifying state management.
- Update `package-lock.json` with new and upgraded dependencies.