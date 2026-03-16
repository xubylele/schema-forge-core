# Schema Forge Core

**Website:** [schemaforge.xuby.cl](https://schemaforge.xuby.cl/) · **npm package:** [@xubylele/schema-forge-core](https://www.npmjs.com/package/@xubylele/schema-forge-core)

`@xubylele/schema-forge-core` is the deterministic engine behind Schema Forge. It contains the full domain logic for parsing, diffing, validating, and generating SQL from declarative schema definitions.

The core is framework-agnostic and built around pure, predictable transformations:

* **Parse** the `.sf` DSL format
* **Normalize** schema into a state model
* **Diff** schema versions to detect structural changes
* **Validate** schema definitions and destructive changes
* **Generate** SQL migration statements
* **Import** and reconstruct schema from existing SQL migrations

Same input → same output.

---

## What's New (v1.3.0)

* Added `analyzeSchemaDrift(state, liveSchema)` to compare live database schemas against `state.json`.
* Added PostgreSQL schema introspection with typed metadata for tables, columns, and constraints.
* Expanded exports and tests for deterministic behavior and safer integration usage.

See full details in the [changelog](./CHANGELOG.md).

---

## Philosophy

* Declarative schema definition
* Deterministic transformations
* Framework agnostic
* Pure domain layer
* Explicit state modeling

The core contains no hidden side effects. All structural changes are derived from explicit schema input and state.

---

## Module Boundaries

### Core (Pure)

Environment-agnostic logic:

* Parsing DSL
* Schema normalization
* Diff engine
* Validation rules
* SQL generation
* SQL parsing to operations
* State modeling

These modules can run in Node.js or browser environments.

### Node Utilities (I/O Helpers)

Node-only helpers for CLI or tooling environments:

* File system utilities
* Project path resolution
* Migration file loading

These require Node.js.

---

## Installation

```bash
npm install @xubylele/schema-forge-core
```

---

## Basic Usage

### Parse → Diff → Generate SQL

```ts
import {
  parseSchema,
  schemaToState,
  diffSchemas,
  generateSql
} from "@xubylele/schema-forge-core"

const schemaSource = `
table users {
  id uuid pk
  email varchar unique
  created_at timestamptz
}
`

// Parse DSL into schema model
const schema = parseSchema(schemaSource)

// Convert schema into normalized state
const state = await schemaToState(schema)

const nextSchemaSource = `
table users {
  id uuid pk
  email varchar unique
  name varchar
  created_at timestamptz
}
`

const nextSchema = parseSchema(nextSchemaSource)

// Compute structural diff
const diff = diffSchemas(state, nextSchema)

// Generate SQL for provider
const sql = generateSql(diff, "postgres")

console.log(sql)
// ALTER TABLE users ADD COLUMN name varchar;
```

---

## Schema Validation

```ts
import {
  validateSchema,
  validateSchemaChanges,
  toValidationReport
} from "@xubylele/schema-forge-core"

const schema = parseSchema(schemaSource)

// Structural validation (throws on invalid schema)
validateSchema(schema)

// Destructive change validation
const findings = validateSchemaChanges(state, nextSchema)
const report = toValidationReport(findings)

report.errors.forEach(f => {
  console.error(`[error] ${f.code}: ${f.message}`)
})

report.warnings.forEach(f => {
  console.warn(`[warning] ${f.code}: ${f.message}`)
})
```

---

## Policy management (RLS)

Schema Forge supports **Row Level Security (RLS)** policies in the DSL. Policies are parsed, validated, diffed, and emitted as PostgreSQL `CREATE POLICY` / `DROP POLICY` statements.

### DSL syntax

Policies are declared at the top level (outside table blocks). The table must be defined before the policy references it.

```
table users {
  id uuid pk
  email text unique
}

policy "Users can read themselves" on users
for select
using auth.uid() = id
```

* **First line:** `policy "<name>" on <table>` — quoted name and table identifier.
* **Continuation lines:**
  * `for <command>` — required; one of `select`, `insert`, `update`, `delete`.
  * `using <expr>` — optional; expression for row visibility (e.g. SELECT) or existing row check (UPDATE/DELETE).
  * `with check <expr>` — optional; expression for new rows (INSERT/UPDATE).

At least one of `using` or `with check` is required (enforced by `validateSchema`).

### AST and state

* **Schema:** `Table.policies` is an array of `PolicyNode` (`name`, `table`, `command`, `using?`, `withCheck?`).
* **State:** `StateTable.policies` is `Record<string, StatePolicy>` (keyed by policy name; `StatePolicy` has `command`, `using?`, `withCheck?`).
* **Operations:** The diff engine emits `create_policy`, `drop_policy`, and `modify_policy` (drop + create) when comparing state to schema.

### Validation

`validateSchema(schema)` runs policy checks and throws if:

* The policy’s table does not exist.
* The command is not one of `select`, `insert`, `update`, `delete`.
* Neither `using` nor `with check` is set and non-empty.

Invalid policies produce clear error messages (e.g. used by the CLI validate command).

### SQL generation (Postgres)

For the `postgres` provider, policies are generated as:

* **Create:** `CREATE POLICY "<name>" ON <table> FOR <COMMAND> [USING (...)] [WITH CHECK (...)];`
* **Drop:** `DROP POLICY "<name>" ON <table>;`
* **Modify:** drop then create (two statements).

RLS must be enabled on the table separately (e.g. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`); the core does not emit that by default.

---

## SQL Import (Reverse Engineering)

```ts
import {
  loadMigrationSqlInput,
  parseMigrationSql,
  applySqlOps,
  schemaToDsl
} from "@xubylele/schema-forge-core"

const inputs = await loadMigrationSqlInput("./migrations")

for (const input of inputs) {
  const parseResult = parseMigrationSql(input.sql)

  if (parseResult.warnings.length > 0) {
    console.warn(parseResult.warnings)
  }

  const result = applySqlOps(parseResult.ops)
  const dsl = schemaToDsl(result.schema)

  console.log(dsl)
}
```

---

## Supported Providers

* `postgres`

Additional providers may be implemented in higher-level packages.

---

## Core API (High-Level)

### Parsing & State

* `parseSchema(source: string): DatabaseSchema`
* `schemaToState(schema: DatabaseSchema): Promise<StateFile>`
* `loadState(filePath: string): Promise<StateFile>`
* `saveState(filePath: string, state: StateFile): Promise<void>`

### Diff Engine

* `diffSchemas(state: StateFile, schema: DatabaseSchema): DiffResult`

### Validation

* `validateSchema(schema: DatabaseSchema): void`
* `validateSchemaChanges(state: StateFile, schema: DatabaseSchema): Finding[]`
* `toValidationReport(findings: Finding[]): ValidationReport`

### SQL Generation

* `generateSql(diff: DiffResult, provider: Provider, config?: SqlConfig): string`

### SQL Parsing & Reconstruction

* `parseMigrationSql(sql: string): ParseResult`
* `applySqlOps(ops: SqlOp[]): ApplySqlOpsResult`
* `schemaToDsl(schema: DatabaseSchema): string`

Full API surface is available via TypeScript exports.

---

## Type Exports

All domain types are exported for integration:

* `DatabaseSchema`, `Table`, `Column`, `ForeignKey`
* `PolicyNode`, `PolicyCommand`, `StatePolicy`
* `StateFile`, `StateTable`, `StateColumn`
* `DiffResult`, `Operation`
* `SqlOp`, `ParseResult`, `ApplySqlOpsResult`
* `Finding`, `ValidationReport`, `Severity`
* `Provider`, `SqlConfig`

---

## Architecture

```
DSL (.sf)
  ↓
Parser → DatabaseSchema
  ↓
State Normalization → StateFile
  ↓
Diff Engine → Operations
  ↓
SQL Generator → Migration SQL
```

---

## Development

```bash
npm install
npm run build
npm test
```

---

## License

ISC
