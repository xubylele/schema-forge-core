export { parseSchema } from './core/parser.js';

export { diffSchemas, getTableNamesFromState, getTableNamesFromSchema, getColumnNamesFromState, getColumnNamesFromSchema } from './core/diff.js';
export { analyzeSchemaDrift } from './core/drift-analyzer.js';
export { validateSchema } from './core/validator.js';
export { validateSchemaChanges, toValidationReport } from './core/validate.js';
export type { Finding, ValidationReport, Severity } from './core/validate.js';

export { classifyOperation, checkOperationSafety, checkSchemaSafety } from './core/safety/index.js';
export type { SafetyLevel, Finding as SafeFinding, SafetyReport, DestructiveOperationCode } from './core/safety/index.js';

export { schemaToState, loadState, saveState } from './core/state-manager.js';
export { buildMigrationPlan, formatMigrationPlanLine, formatMigrationPlanLines } from './core/plan-builder.js';
export type { MigrationPlanAction, MigrationPlanSymbol, MigrationPlanEntry, MigrationPlanResult } from './core/plan-builder.js';

export { generateSql } from './generator/sql-generator.js';
export type { Provider, SqlConfig } from './generator/sql-generator.js';

export { parseMigrationSql, parseCreateTable, parseAlterTableAddColumn, parseAlterColumnType, parseSetDropNotNull, parseSetDropDefault, parseAddDropConstraint, parseDropColumn, parseDropTable, parseEnableRls, parseCreatePolicy } from './core/sql/parse-migration.js';
export { applySqlOps } from './core/sql/apply-ops.js';
export { schemaToDsl } from './core/sql/schema-to-dsl.js';
export { loadMigrationSqlInput } from './core/sql/load-migrations.js';
export type { MigrationSqlInput } from './core/sql/load-migrations.js';
export { splitSqlStatements } from './core/sql/split-statements.js';
export { introspectPostgresSchema } from './core/sql/introspect-postgres.js';

export { ensureDir, fileExists, readTextFile, writeTextFile, readJsonFile, writeJsonFile, findFiles } from './core/fs.js';

export {
	normalizeIdent,
	pkName,
	uqName,
	legacyPkName,
	legacyUqName,
	normalizeDefault,
	normalizeSqlExpression,
	hashSqlContent,
	deterministicIndexName,
} from './core/normalize.js';

export { getProjectRoot, getSchemaForgeDir, getSchemaFilePath, getConfigPath, getStatePath } from './core/paths.js';

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
	IndexNode,
	ViewNode,
	StateColumn,
	StateIndex,
	StatePolicy,
	StateView,
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
