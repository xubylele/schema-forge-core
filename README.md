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

## What's New (v1.6.0)

* Added migration plan builder APIs: `buildMigrationPlan`, `formatMigrationPlanLine`, and `formatMigrationPlanLines` to preview operations as human-readable steps (`+` create, `~` modify, `-` delete) without SQL execution.
* Added PostgreSQL view support in DSL with deterministic hash-based diffing and `CREATE OR REPLACE VIEW` generation.
* Added PostgreSQL index support in DSL, including unique, partial, and expression indexes with deterministic auto-naming.

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

## Migration Plan Preview

Schema Forge Core can convert diff operations into a human-readable migration plan without executing SQL.

Use this when you want a clear preview of what will happen before generating or running migrations.

```ts
import {
  parseSchema,
  schemaToState,
  diffSchemas,
  buildMigrationPlan,
} from "@xubylele/schema-forge-core"

const currentSchema = parseSchema(currentSchemaSource)
const currentState = await schemaToState(currentSchema)

const nextSchema = parseSchema(nextSchemaSource)
const diff = diffSchemas(currentState, nextSchema)

const plan = buildMigrationPlan(diff)

console.log(plan.lines.join("\n"))
// + create table posts
// + add column avatar_url to users
// ~ modify column email type on users (varchar -> text)
// - drop column age from users
```

The plan result contains:

* `entries`: structured metadata for each operation (`action`, `symbol`, `operationKind`, `summary`, and optional table/column/from/to fields).
* `lines`: preformatted human-readable lines ready for CLI or UI output.

Symbol mapping is deterministic:

* `+` create/add operations
* `~` modify/change/replace operations
* `-` drop/delete operations

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

```sql
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

### Validation Schema Forge enforces basic policy validity rules

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

## Index Support

Schema Forge supports PostgreSQL indexes in the DSL, including standard indexes, unique indexes, partial indexes (`WHERE`), and expression indexes.

### DSL syntax for indexes

Indexes are declared at the top level (outside table blocks), similar to policies.

Block style with columns:

```sql
table users {
  id uuid pk
  org_id uuid
  email text
  deleted_at timestamptz nullable
}

index idx_users_org_email on users
columns org_id, email
unique
where deleted_at is null
```

Expression index (block style):

```sql
index idx_users_lower_email on users
expression lower(email)
```

Expression index (inline `on (...)` style):

```sql
index idx_users_lower_email on users(lower(email))
```

Omitted name is supported and resolved deterministically.

```sql
index on users
columns email
```

### Parser behavior

Parser guarantees for indexes:

* Exactly one target kind is required: either `columns ...` or `expression ...`.
* Duplicate clauses are rejected (`columns`, `unique`, `where`, `expression`).
* Expression/where text is preserved for SQL output, with normalized whitespace for deterministic comparisons.
* If name is omitted, a deterministic name is generated.

### AST, state, and diff behavior

* **AST:** indexes are stored in `Table.indexes` as `IndexNode[]`.
* **State:** indexes are persisted in `StateTable.indexes` as `Record<string, StateIndex>`.
* **Operations:** diff emits `create_index` and `drop_index`.
* **Modify semantics:** index changes are represented as deterministic `drop_index` + `create_index` pairs.

### Validation

`validateSchema(schema)` index checks include:

* Target table must exist.
* Referenced columns must exist on the target table.
* Expression indexes must have a non-empty expression.
* Duplicate index names (after deterministic-name expansion) are rejected per table.

### SQL generation (Postgres) for indexes

Index operations generate PostgreSQL DDL:

* `CREATE INDEX <name> ON <table> (<columns>);`
* `CREATE UNIQUE INDEX <name> ON <table> (<columns>);`
* `CREATE [UNIQUE] INDEX <name> ON <table> (<expression>) [WHERE ...];`
* `DROP INDEX IF EXISTS <name>;`

Drop generation includes deterministic fallback naming behavior for compatibility with omitted-name definitions.

### Safety classification

* `create_index` is treated as safe.
* `drop_index` is treated as warning-level.

This lets index changes flow through the same safety/reporting pipeline used by other schema operations.

---

## View Support

Schema Forge supports PostgreSQL views in the DSL as raw SQL query bodies.

### DSL syntax for views is simple: `view <name> as <sql>`. The SQL body is stored as-is in the AST and state, with normalized whitespace for deterministic diffing

```sql
view user_posts as
select * from posts where user_id = auth.uid()
```

* **Declaration:** `view <name> as <sql>`.
* **Query body:** stored as raw SQL text in the AST/state.
* **Scope:** view definitions are tracked by name and query hash.

### AST, state, and diff behavior for views

* **AST:** `ViewNode` includes `name`, `query`, and `hash`.
* **State:** `StateView` is used in persisted state snapshots for view definitions.
* **Snapshot conversion:** parser output is converted into persisted state with deterministic view hashes.
* **Diff:** compares view `hash` values.
  * New view -> `create_view`
  * Removed view -> `drop_view`
  * Same name with changed hash -> `replace_view`

### Safety classification for views

View operations are included in safety checks and reports:

* `create_view` is treated as safe.
* `replace_view` is treated as warning-level change.
* `drop_view` is treated as destructive change.

This allows consumers (CLI/API) to gate or report view changes using the same validation pipeline as table and policy operations.

### SQL generation

For `postgres`, view operations generate:

* `CREATE OR REPLACE VIEW <name> AS <query>;` (for both create and replace)
* `DROP VIEW IF EXISTS <name>;`

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

## Documentation

* [RLS policy patterns (PostgreSQL / Supabase)](./docs/rls-policy-patterns.md) – user-owned rows, public read / authenticated write, multi-tenant examples.

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

### Validation schema and changes

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
* `IndexNode`, `StateIndex`
* `ViewNode`, `StateView`
* `StateFile`, `StateTable`, `StateColumn`
* `DiffResult`, `Operation`
* `SqlOp`, `ParseResult`, `ApplySqlOpsResult`
* `Finding`, `ValidationReport`, `Severity`
* `Provider`, `SqlConfig`

---

## Architecture

```bash
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
