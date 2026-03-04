// Core parsing and schema functionality
export { parseSchema } from './core/parser.js';

// Diff and validation
export { diffSchemas, getTableNamesFromState, getTableNamesFromSchema, getColumnNamesFromState, getColumnNamesFromSchema } from './core/diff.js';
export { validateSchema } from './core/validator.js';
export { validateSchemaChanges, toValidationReport } from './core/validate.js';
export type { Finding, ValidationReport, Severity } from './core/validate.js';

// Safety middleware layer (centralized destructive operation handling)
export { classifyOperation, checkOperationSafety, checkSchemaSafety } from './core/safety/index.js';
export type { SafetyLevel, Finding as SafeFinding, SafetyReport, DestructiveOperationCode } from './core/safety/index.js';

// State management
export { schemaToState, loadState, saveState } from './core/state-manager.js';

// SQL Generation
export { generateSql } from './generator/sql-generator.js';
export type { Provider, SqlConfig } from './generator/sql-generator.js';

// SQL Parsing and Import
export { parseMigrationSql, parseCreateTable, parseAlterTableAddColumn, parseAlterColumnType, parseSetDropNotNull, parseSetDropDefault, parseAddDropConstraint, parseDropColumn, parseDropTable } from './core/sql/parse-migration.js';
export { applySqlOps } from './core/sql/apply-ops.js';
export { schemaToDsl } from './core/sql/schema-to-dsl.js';
export { loadMigrationSqlInput } from './core/sql/load-migrations.js';
export type { MigrationSqlInput } from './core/sql/load-migrations.js';
export { splitSqlStatements } from './core/sql/split-statements.js';
export { introspectPostgresSchema } from './core/sql/introspect-postgres.js';

// File system utilities
export { ensureDir, fileExists, readTextFile, writeTextFile, readJsonFile, writeJsonFile, findFiles } from './core/fs.js';

// Normalization utilities
export { normalizeIdent, pkName, uqName, legacyPkName, legacyUqName, normalizeDefault } from './core/normalize.js';

// Path utilities
export { getProjectRoot, getSchemaForgeDir, getSchemaFilePath, getConfigPath, getStatePath } from './core/paths.js';

// General utilities
export { nowTimestamp, slugifyName } from './core/utils.js';

// Errors
export { SchemaValidationError } from './core/errors.js';

// Types
export type {
	ColumnType,
	ForeignKey,
	Column,
	Table,
	DatabaseSchema,
	StateColumn,
	StateTable,
	StateFile,
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
