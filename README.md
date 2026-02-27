# Schema Forge Core

schema-forge-core is the core engine for Schema Forge, providing all the logic for parsing, diffing, validating, and generating SQL from schema definitions.

It provides pure, deterministic logic for:

- **Parsing** the .sf DSL format
- **Diffing** schema versions to detect changes
- **Validating** schema structures and changes
- **Generating** SQL migration statements
- **Importing** from existing SQL migrations
- **State management** for tracking schema versions

This package is **framework agnostic** and can be used in any Node.js or browser environment.

---

## Philosophy

- Declarative
- Deterministic
- Framework agnostic
- Pure functional domain layer

Same input → same output.

---

## Installation

```bash
npm install @xubylele/schema-forge-core
```

---

## Usage

### Basic Schema Operations

```ts
import {
  parseSchema,
  schemaToState,
  diffSchemas,
  generateSql
} from "@xubylele/schema-forge-core"

// Parse a schema from DSL
const schema = `
table users {
  id uuid pk
  email varchar unique
  created_at timestamptz
}
`

const ast = parseSchema(schema);

// Convert to state format for diffing
const state = await schemaToState(ast);

// Compare with a new version
const nextSchema = `
table users {
  id uuid pk
  email varchar unique
  name varchar
  created_at timestamptz
}
`

const nextAst = parseSchema(nextSchema);
const diff = diffSchemas(state, nextAst);

// Generate SQL from diff
const sql = generateSql(diff, 'postgres');
console.log(sql);
// Outputs: ALTER TABLE users ADD COLUMN name varchar;
```

### Schema Validation

```ts
import {
  validateSchema,
  validateSchemaChanges,
  toValidationReport
} from "@xubylele/schema-forge-core"

// Validate schema structure (throws on failure)
const schema = parseSchema(schemaSource);
try {
  validateSchema(schema);
} catch (error) {
  console.error('Invalid schema:', error);
}

// Validate schema changes for destructive operations
const state = await loadState('./state.json');
const nextSchema = parseSchema(newSchemaSource);
const findings = validateSchemaChanges(state, nextSchema);
const report = toValidationReport(findings);

report.errors.forEach(finding => {
  console.log(`[error] ${finding.code}: ${finding.message}`);
});

report.warnings.forEach(finding => {
  console.log(`[warning] ${finding.code}: ${finding.message}`);
});
```

### SQL Import

```ts
import {
  loadMigrationSqlInput,
  parseMigrationSql,
  applySqlOps,
  schemaToDsl
} from "@xubylele/schema-forge-core"

// Load SQL from file or directory
const inputs = await loadMigrationSqlInput('./migrations');

for (const input of inputs) {
  // Parse SQL to operations
  const parseResult = parseMigrationSql(input.sql);

  if (parseResult.warnings.length > 0) {
    console.warn('Parse warnings:', parseResult.warnings);
  }

  // Apply operations to build schema
  const result = applySqlOps(parseResult.ops);

  // Convert back to DSL
  const dsl = schemaToDsl(result.schema);
  console.log(dsl);
}
```

### File System Utilities

```ts
import { 
  readTextFile, 
  writeTextFile,
  readJsonFile,
  writeJsonFile,
  findFiles
} from "@xubylele/schema-forge-core"

// Read/write text files
const content = await readTextFile('./schema.sf');
await writeTextFile('./output.sf', dslOutput);

// Read/write JSON
const state = await readJsonFile('./state.json');
await writeJsonFile('./state.json', newState);

// Find files matching pattern
const files = await findFiles('./migrations', /\.sql$/);
```

---

## API Reference

### Core Functions

- `parseSchema(source: string): DatabaseSchema` - Parse DSL to schema AST
- `diffSchemas(state: StateFile, schema: DatabaseSchema): DiffResult` - Compute changes between versions
- `getTableNamesFromState(state: StateFile): Set<string>` - List tables from a persisted state
- `getTableNamesFromSchema(schema: DatabaseSchema): Set<string>` - List tables from a schema
- `getColumnNamesFromState(stateColumns: Record<string, StateColumn>): Set<string>` - List columns from a state table
- `getColumnNamesFromSchema(columns: Column[]): Set<string>` - List columns from a schema table
- `validateSchema(schema: DatabaseSchema): void` - Validate schema structure (throws on failure)
- `validateSchemaChanges(state: StateFile, schema: DatabaseSchema): Finding[]` - Detect destructive changes
- `toValidationReport(findings: Finding[]): ValidationReport` - Split findings into error/warning buckets
- `generateSql(diff: DiffResult, provider: Provider, config?: SqlConfig): string` - Generate SQL from diff

### State Management

- `schemaToState(schema: DatabaseSchema): Promise<StateFile>` - Convert schema to state format
- `loadState(filePath: string): Promise<StateFile>` - Load state from JSON file (fallbacks to empty)
- `saveState(filePath: string, state: StateFile): Promise<void>` - Save state to JSON file

### SQL Parsing & Import

- `parseMigrationSql(sql: string): ParseResult` - Parse SQL to operations and warnings
- `parseCreateTable(statement: string): SqlOp | null` - Parse a CREATE TABLE statement
- `parseAlterTableAddColumn(statement: string): SqlOp | null` - Parse an ALTER TABLE ADD COLUMN statement
- `parseAlterColumnType(statement: string): SqlOp | null` - Parse an ALTER TABLE ALTER COLUMN TYPE statement
- `parseSetDropNotNull(statement: string): SqlOp | null` - Parse SET/DROP NOT NULL statements
- `parseSetDropDefault(statement: string): SqlOp | null` - Parse SET/DROP DEFAULT statements
- `parseAddDropConstraint(statement: string): SqlOp | null` - Parse ADD/DROP CONSTRAINT statements
- `parseDropColumn(statement: string): SqlOp | null` - Parse a DROP COLUMN statement
- `parseDropTable(statement: string): SqlOp | null` - Parse a DROP TABLE statement
- `applySqlOps(ops: SqlOp[]): ApplySqlOpsResult` - Build schema from SQL operations
- `schemaToDsl(schema: DatabaseSchema): string` - Convert schema back to DSL format
- `loadMigrationSqlInput(pathInput: string): Promise<MigrationSqlInput[]>` - Load SQL from file/directory
- `splitSqlStatements(sql: string): string[]` - Split SQL into individual statements

### Utilities

- **File System**: `ensureDir`, `fileExists`, `readTextFile`, `writeTextFile`, `readJsonFile`, `writeJsonFile`, `findFiles`
- **Normalization**: `normalizeIdent`, `pkName`, `uqName`, `legacyPkName`, `legacyUqName`, `normalizeDefault`
- **Paths**: `getProjectRoot`, `getSchemaForgeDir`, `getSchemaFilePath`, `getConfigPath`, `getStatePath`
- **General**: `nowTimestamp`, `slugifyName`

---

## Architecture

```
DSL (.sf)
  |
Parser -> AST (DatabaseSchema)
  |
State Manager -> Normalized State
  |
Diff Engine -> Operations
  |
SQL Generator -> Migration SQL
```

---

## Type Definitions

All TypeScript types are exported for use in your application:

- `DatabaseSchema`, `Table`, `Column`, `ColumnType`, `ForeignKey`
- `StateFile`, `StateTable`, `StateColumn`
- `Operation`, `DiffResult`
- `SqlOp`, `ParsedColumn`, `ParsedConstraint`, `ParseWarning`, `ParseResult`, `ApplySqlOpsResult`
- `Finding`, `ValidationReport`, `Severity`
- `Provider`, `SqlConfig`

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
