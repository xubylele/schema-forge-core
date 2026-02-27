# Schema Forge Core

schema-forge-core is the domain engine behind Schema Forge.

It provides pure, deterministic logic for:

- Parsing the .sf DSL
- Creating normalized schema snapshots
- Computing diffs between schema versions
- Generating SQL statements from structural changes

This package contains no CLI logic and no file system access.

---

## Philosophy

- Declarative
- Deterministic
- Framework agnostic
- Pure functional domain layer

Same input -> same output.

---

## Installation

```bash
npm install @xubylele/schema-forge-core
```

---

## Usage

```ts
import {
  parseSchema,
  createSnapshot,
  diffSchemas,
  generateSQL
} from "@xubylele/schema-forge-core"

const schema = `
table users {
  id uuid pk
  email varchar unique
}
`

const ast = parseSchema(schema)
const snapshot = createSnapshot(ast)
const diff = diffSchemas(previousSnapshot, snapshot)
const sql = generateSQL(diff)
```

---

## Architecture

```
DSL (.sf)
   ->
Parser -> AST
   ->
Snapshot Engine -> Normalized Model
   ->
Diff Engine -> Change Set
   ->
SQL Generator -> SQL Statements
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
