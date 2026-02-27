import type { Column, DiffResult, Operation, Table } from '../types/schema';
import { legacyPkName, legacyUqName, pkName, uqName } from '../core/normalize';

export type Provider = 'supabase' | 'postgres';

export interface SqlConfig {
  uuidDefault?: string;
  timestampDefault?: string;
}

export function generateSql(
  diff: DiffResult,
  provider: Provider,
  sqlConfig?: SqlConfig
): string {
  const statements: string[] = [];

  for (const operation of diff.operations) {
    const sql = generateOperation(operation, provider, sqlConfig);
    if (sql) {
      statements.push(sql);
    }
  }

  return statements.join('\n\n');
}

function generateOperation(
  operation: Operation,
  provider: Provider,
  sqlConfig?: SqlConfig
): string {
  switch (operation.kind) {
    case 'create_table':
      return generateCreateTable(operation.table, provider, sqlConfig);
    case 'drop_table':
      return generateDropTable(operation.tableName);
    case 'column_type_changed':
      return generateAlterColumnType(
        operation.tableName,
        operation.columnName,
        operation.toType
      );
    case 'column_nullability_changed':
      return generateAlterColumnNullability(
        operation.tableName,
        operation.columnName,
        operation.to
      );
    case 'add_column':
      return generateAddColumn(operation.tableName, operation.column, provider, sqlConfig);
    case 'column_default_changed':
      return generateAlterColumnDefault(
        operation.tableName,
        operation.columnName,
        operation.toDefault
      );
    case 'drop_column':
      return generateDropColumn(operation.tableName, operation.columnName);
    case 'column_unique_changed':
      return operation.to
        ? generateAddUniqueConstraint(operation.tableName, operation.columnName)
        : generateDropUniqueConstraint(operation.tableName, operation.columnName);
    case 'drop_primary_key_constraint':
      return generateDropPrimaryKeyConstraint(operation.tableName);
    case 'add_primary_key_constraint':
      return generateAddPrimaryKeyConstraint(operation.tableName, operation.columnName);
  }
}

function generateCreateTable(
  table: Table,
  provider: Provider,
  sqlConfig?: SqlConfig
): string {
  const columnDefs = table.columns.map(col =>
    generateColumnDefinition(col, provider, sqlConfig)
  );

  const lines = ['CREATE TABLE ' + table.name + ' ('];
  columnDefs.forEach((colDef, index) => {
    const isLast = index === columnDefs.length - 1;
    lines.push('  ' + colDef + (isLast ? '' : ','));
  });
  lines.push(');');

  return lines.join('\n');
}

function generateColumnDefinition(
  column: Column,
  provider: Provider,
  sqlConfig?: SqlConfig
): string {
  const parts: string[] = [column.name, column.type];

  // Foreign key inline
  if (column.foreignKey) {
    parts.push(
      `references ${column.foreignKey.table}(${column.foreignKey.column})`
    );
  }

  // Primary key
  if (column.primaryKey) {
    parts.push('primary key');
  }

  // Unique
  if (column.unique) {
    parts.push('unique');
  }

  // Nullable
  if (column.nullable === false) {
    parts.push('not null');
  }

  // Default
  if (column.default !== undefined) {
    parts.push('default ' + column.default);
  } else if (
    column.type === 'uuid' &&
    column.primaryKey &&
    provider === 'supabase'
  ) {
    parts.push('default gen_random_uuid()');
  }

  return parts.join(' ');
}

function generateDropTable(tableName: string): string {
  return `DROP TABLE ${tableName};`;
}

function generateAddColumn(
  tableName: string,
  column: Column,
  provider: Provider,
  sqlConfig?: SqlConfig
): string {
  const colDef = generateColumnDefinition(column, provider, sqlConfig);
  return `ALTER TABLE ${tableName} ADD COLUMN ${colDef};`;
}

function generateDropColumn(tableName: string, columnName: string): string {
  return `ALTER TABLE ${tableName} DROP COLUMN ${columnName};`;
}

function generateAlterColumnType(
  tableName: string,
  columnName: string,
  newType: string
): string {
  return `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} TYPE ${newType} USING ${columnName}::${newType};`;
}

function generateAddUniqueConstraint(tableName: string, columnName: string): string {
  const deterministicConstraintName = uqName(tableName, columnName);
  return `ALTER TABLE ${tableName} ADD CONSTRAINT ${deterministicConstraintName} UNIQUE (${columnName});`;
}

function generateDropUniqueConstraint(tableName: string, columnName: string): string {
  const deterministicConstraintName = uqName(tableName, columnName);
  const fallbackConstraintName = legacyUqName(tableName, columnName);
  return generateDropConstraintStatements(tableName, [deterministicConstraintName, fallbackConstraintName]);
}

function generateDropPrimaryKeyConstraint(tableName: string): string {
  const deterministicConstraintName = pkName(tableName);
  const fallbackConstraintName = legacyPkName(tableName);
  return generateDropConstraintStatements(tableName, [deterministicConstraintName, fallbackConstraintName]);
}

function generateAddPrimaryKeyConstraint(tableName: string, columnName: string): string {
  const deterministicConstraintName = pkName(tableName);
  return `ALTER TABLE ${tableName} ADD CONSTRAINT ${deterministicConstraintName} PRIMARY KEY (${columnName});`;
}

function generateDropConstraintStatements(tableName: string, constraintNames: string[]): string {
  const uniqueConstraintNames = Array.from(new Set(constraintNames));
  return uniqueConstraintNames
    .map(constraintName =>
      `ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${constraintName};`
    )
    .join('\n');
}

function generateAlterColumnDefault(
  tableName: string,
  columnName: string,
  newDefault: string | null
): string {
  if (newDefault === null) {
    return `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} DROP DEFAULT;`;
  }

  return `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} SET DEFAULT ${newDefault};`;
}

function generateAlterColumnNullability(
  tableName: string,
  columnName: string,
  toNullable: boolean
): string {
  if (toNullable) {
    return `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} DROP NOT NULL;`;
  }

  return `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} SET NOT NULL;`;
}
