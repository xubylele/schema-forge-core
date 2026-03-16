/**
 * Browser entry point. Exports parser, diff engine, and all APIs that do not
 * depend on Node (fs, path, process). Use this entry when bundling for the browser.
 */

export { parseSchema } from './core/parser.js';
export {
  diffSchemas,
  getTableNamesFromState,
  getTableNamesFromSchema,
  getColumnNamesFromState,
  getColumnNamesFromSchema,
} from './core/diff.js';
export { analyzeSchemaDrift } from './core/drift-analyzer.js';
export { validateSchema } from './core/validator.js';
export { validateSchemaChanges, toValidationReport } from './core/validate.js';
export type { Finding, ValidationReport, Severity } from './core/validate.js';

export { classifyOperation, checkOperationSafety, checkSchemaSafety } from './core/safety/index.js';
export type {
  SafetyLevel,
  Finding as SafeFinding,
  SafetyReport,
  DestructiveOperationCode,
} from './core/safety/index.js';

export { schemaToState } from './core/state-transform.js';

export { generateSql } from './generator/sql-generator.js';
export type { Provider, SqlConfig } from './generator/sql-generator.js';

export {
  parseMigrationSql,
  parseCreateTable,
  parseAlterTableAddColumn,
  parseAlterColumnType,
  parseSetDropNotNull,
  parseSetDropDefault,
  parseAddDropConstraint,
  parseDropColumn,
  parseDropTable,
} from './core/sql/parse-migration.js';
export { applySqlOps } from './core/sql/apply-ops.js';
export { schemaToDsl } from './core/sql/schema-to-dsl.js';
export { splitSqlStatements } from './core/sql/split-statements.js';
export { introspectPostgresSchema } from './core/sql/introspect-postgres.js';

export {
  normalizeIdent,
  pkName,
  uqName,
  legacyPkName,
  legacyUqName,
  normalizeDefault,
} from './core/normalize.js';

export { nowTimestamp, slugifyName } from './core/utils.js';
export { SchemaValidationError } from './core/errors.js';

export type {
  ColumnType,
  ForeignKey,
  Column,
  Table,
  DatabaseSchema,
  PolicyCommand,
  PolicyNode,
  StateColumn,
  StatePolicy,
  StateTable,
  StateFile,
  DriftColumnDifference,
  DriftTypeMismatch,
  DriftReport,
  Operation,
  DiffResult,
} from './types/schema.js';
export type {
  SqlOp,
  ParsedColumn,
  ParsedConstraint,
  ParseWarning,
  ParseResult,
  ApplySqlOpsResult,
  PostgresQueryExecutor,
  PostgresIntrospectionOptions,
  PostgresIntrospectionTableRow,
  PostgresIntrospectionColumnRow,
  PostgresIntrospectionConstraintRow,
  PostgresIntrospectionForeignKeyRow,
  NormalizedPostgresConstraint,
} from './types/sql.js';
