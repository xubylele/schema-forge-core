# @xubylele/schema-forge-core

## 1.0.4

### Patch Changes

- c887775: Fix ESM package resolution when installed by Node apps.

  - Switch TypeScript config to `NodeNext` module and module resolution.
  - Add explicit `.js` extensions to internal relative imports/exports in source so emitted `dist` is Node ESM-compatible.
  - Prevent runtime type re-export hazards from the package entry by using type-only exports for schema types.

  This fixes consumer errors like "Cannot find module .../dist/core/parser" when importing `@xubylele/schema-forge-core` from installed dependencies.

## 1.0.3

### Patch Changes

- c6c58b7: \* Update release workflow trigger to use `pull_request`

  - Add repository metadata to `package.json`

  These changes improve CI behavior and package metadata without modifying runtime logic or public API.

## 1.0.2

### Patch Changes

- 576e271: \* Correct author name in `package.json`

  - Add `publishConfig` configuration for public scoped publishing
  - Update contributing guidelines
  - Add release flow documentation

  These changes improve project metadata clarity and formalize contribution and release processes without affecting runtime behavior.

## 1.0.1

### Patch Changes

- 576e271: \* Correct author name in `package.json`

  - Add `publishConfig` configuration for public scoped publishing
  - Update contributing guidelines
  - Add release flow documentation

  These changes improve project metadata clarity and formalize contribution and release processes without affecting runtime behavior.

## 1.0.0

### Major Changes

- 54e430d: ## "@xubylele/schema-forge-core": major

  # 🚀 1.0.0 — Stable Core Engine Release

  This release marks the first stable architecture of `schema-forge-core`.

  The full domain engine has been extracted and finalized, including:

  - DSL parser
  - Snapshot engine
  - Diff engine
  - SQL generator
  - Fully typed public API
  - Deterministic transformation flow

  ***

  ## 🔥 Breaking Changes

  - Public API is now officially defined and locked
  - Internal structures (AST, snapshot shape, diff format) are considered stable
  - Any previous experimental imports or unstable paths are removed

  Consumers must now use only:

  ```ts
  import {
    parseSchema,
    createSnapshot,
    diffSchemas,
    generateSQL,
  } from "@xubylele/schema-forge-core";
  ```

  ***

  ## 🧠 Architectural Guarantees

  - Pure functions only (no filesystem access)
  - No provider coupling
  - No CLI logic
  - Deterministic output
  - Strict TypeScript typing

  ***

  ## 📦 Why Major?

  This release defines the long-term stable foundation for:

  - Schema Forge CLI
  - VSCode extension
  - Future web diff UI
  - Multi-database providers

  The API surface is now considered production-ready.
