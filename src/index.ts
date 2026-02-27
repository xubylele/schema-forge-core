// Core parsing and schema functionality
export { parseSchema } from './core/parser';

// Diff and validation
export { diffSchemas, getTableNamesFromState, getTableNamesFromSchema, getColumnNamesFromState, getColumnNamesFromSchema } from './core/diff';
export { validateSchema } from './core/validator';
export { validateSchemaChanges, toValidationReport } from './core/validate';
export type { Finding, ValidationReport, Severity } from './core/validate';

// State management
export { schemaToState, loadState, saveState } from './core/state-manager';

// SQL Generation
export { generateSql } from './generator/sql-generator';
export type { Provider, SqlConfig } from './generator/sql-generator';

// SQL Parsing and Import
export { parseMigrationSql, parseCreateTable, parseAlterTableAddColumn, parseAlterColumnType, parseSetDropNotNull, parseSetDropDefault, parseAddDropConstraint, parseDropColumn, parseDropTable } from './core/sql/parse-migration';
export { applySqlOps } from './core/sql/apply-ops';
export { schemaToDsl } from './core/sql/schema-to-dsl';
export { loadMigrationSqlInput } from './core/sql/load-migrations';
export type { MigrationSqlInput } from './core/sql/load-migrations';
export { splitSqlStatements } from './core/sql/split-statements';

// File system utilities
export { ensureDir, fileExists, readTextFile, writeTextFile, readJsonFile, writeJsonFile, findFiles } from './core/fs';

// Normalization utilities
export { normalizeIdent, pkName, uqName, legacyPkName, legacyUqName, normalizeDefault } from './core/normalize';

// Path utilities
export { getProjectRoot, getSchemaForgeDir, getSchemaFilePath, getConfigPath, getStatePath } from './core/paths';

// General utilities
export { nowTimestamp, slugifyName } from './core/utils';

// Errors
export { SchemaValidationError } from './core/errors';

// Types
export * from './types/schema';
export type { SqlOp, ParsedColumn, ParsedConstraint, ParseWarning, ParseResult, ApplySqlOpsResult } from './types/sql';
