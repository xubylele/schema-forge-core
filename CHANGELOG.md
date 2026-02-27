# @xubylele/schema-forge-core

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
