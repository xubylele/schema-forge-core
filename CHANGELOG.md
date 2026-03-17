# @xubylele/schema-forge-core

## 1.5.0

### Minor Changes

- 0ee765e: ✨ feat(policies): add full RLS and policy support across parsing, diffing, and SQL

  - Add support for `ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` in SQL parsing.
  - Extend `applySqlOps` to handle RLS and policy-related operations.
  - Include policies in schema rendering output.
  - Add `all` command to apply policies to SELECT, INSERT, UPDATE, and DELETE.
  - Support `to` clause for role-based policy definitions.
  - Update parsing, validation, and SQL generation to support policy features.
  - Improve parsing of `ENABLE ROW LEVEL SECURITY` (whitespace normalization and optional semicolon).
  - Add comprehensive tests covering parsing, validation, SQL generation, and edge cases.

## 1.4.0

### Minor Changes

- 8307d34: ✨ feat(validate): add policy validation in schema checks

  - Add validation ensuring policies reference existing tables.
  - Validate policy commands and require at least one expression (`USING` or `WITH CHECK`).
  - Integrate policy validation into the schema validation workflow.
  - Add tests covering valid and invalid policy configurations.

- a50247e: ✨ feat(policies): enable Row Level Security when generating policy SQL

  - Generate SQL to enable Row Level Security (RLS) when creating or modifying policies.
  - Ensure RLS is enabled only once per table even when multiple policies exist.
  - Add tests verifying correct RLS statement generation during policy operations.

- 2dca1cb: ✨ feat(policies): add policy management support in schema state

  - Add new types `PolicyCommand`, `PolicyNode`, and `StatePolicy` for policy definitions.
  - Extend `Table` and `StateTable` interfaces with optional `policies` property.
  - Update `schemaToState` and `createSnapshot` to handle table policies.

- f12118c: ✨ feat(diff): add policy operations to schema diffing

  - Add support for policy creation, modification, and deletion during schema diffing.
  - Introduce new operation types: `create_policy`, `modify_policy`, and `drop_policy`.
  - Extend `diffSchemas` to detect policy changes between schema states.
  - Classify policy operations for safety: `create_policy` (SAFE), `modify_policy` (WARNING), `drop_policy` (DESTRUCTIVE).
  - Implement SQL generation for policy operations.
  - Add tests covering policy diffing and SQL generation.

- 4e8e6d3: ✨ feat(parser): add policy parsing support in schema definitions

  - Extend `parseSchema` to support table policy declarations.
  - Add `parsePolicyBlock` to parse policy commands and conditions.
  - Update table structures to include optional `policies` property.
  - Add tests for policy parsing, including validation and duplicate command detection.

## 1.3.2

### Patch Changes

- 00320c0: 📝 docs: add homepage metadata and update website links

  - Add `homepage` field to `package.json` for better project visibility.
  - Update `README.md` to include the new website link alongside the npm package reference.

## 1.3.1

### Patch Changes

- be3bc3c: ♻️ chore(core): update dependencies and refactor state management

  - Add `tsup` as a dev dependency for building browser-compatible bundles.
  - Update `package.json` scripts to include a browser build step.
  - Refactor `schemaToState` to export from `state-transform.js`, simplifying state management.
  - Update `package-lock.json` with new and upgraded dependencies.

## 1.3.0

### Minor Changes

- 8bd20d7: feat(drift): add schema drift analyzer against state snapshots

  - Added `analyzeSchemaDrift(state, liveSchema)` to compare live DB schemas with `state.json`.
  - Added structured `DriftReport` output for missing tables, extra tables, column differences, and type mismatches.
  - Exported drift analyzer APIs and added focused tests for acceptance criteria and deterministic ordering.

- 8bd20d7: ✨ feat(postgres): add PostgreSQL schema introspection functionality

  - Introduced a dedicated module for PostgreSQL schema introspection.
  - Implemented metadata extraction for tables, columns, and constraints.
  - Added strongly typed introspection result interfaces for improved type safety.
  - Exposed the new introspection function through the main module export.
  - Added unit tests to validate metadata mapping and ensure accurate schema representation.

## 1.2.0

### Minor Changes

- 2aa4c72: # ✨ feat(safety): introduce centralized safety middleware layer for destructive operation validation

  - Created new `safety/` module to encapsulate safety logic.
  - Added `operation-classifier.ts` to classify operations as `SAFE`, `WARNING`, or `DESTRUCTIVE`.
  - Added `safety-checker.ts` to evaluate classified operations and produce a structured safety report.
  - Ensured all destructive operations pass through the safety middleware before execution.
  - Standardized middleware result object (e.g. `{ level, blocked, warnings, operations }`).
  - Integrated middleware with CLI command execution flow.
  - Added comprehensive unit tests for classification logic, middleware behavior, and edge cases.

## 1.1.0

### Minor Changes

- 0ad04d7: # Feat: add syntax validations for column types and default values in schema parser

  - Added validation logic for column types to ensure correct schema definitions
  - Introduced validation for default values to prevent invalid SQL generation
  - Improved parser robustness by catching syntax issues earlier in the process

## 1.0.5

### Patch Changes

- e51acef: # Add npm package link to README and introduce schema and SQL types for database operations

  - Added npm package link in README for easier access and installation
  - Introduced schema types to standardize database structure definitions
  - Added SQL types to support typed database operations and improve type safety

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
