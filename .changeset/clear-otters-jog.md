---
"@xubylele/schema-forge-core": patch
---

Fix ESM package resolution when installed by Node apps.

- Switch TypeScript config to `NodeNext` module and module resolution.
- Add explicit `.js` extensions to internal relative imports/exports in source so emitted `dist` is Node ESM-compatible.
- Prevent runtime type re-export hazards from the package entry by using type-only exports for schema types.

This fixes consumer errors like "Cannot find module .../dist/core/parser" when importing `@xubylele/schema-forge-core` from installed dependencies.
