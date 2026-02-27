import type { ColumnType, DatabaseSchema, Table } from '../types/schema.js';

/**
 * Valid column types for the database
 */
const VALID_BASE_COLUMN_TYPES: ColumnType[] = [
  'uuid',
  'varchar',
  'text',
  'int',
  'bigint',
  'boolean',
  'timestamptz',
  'date',
];

function isValidColumnType(type: string): boolean {
  const normalizedType = type
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*\)\s*/g, ')');

  if (VALID_BASE_COLUMN_TYPES.includes(normalizedType as ColumnType)) {
    return true;
  }

  return /^varchar\(\d+\)$/.test(normalizedType) || /^numeric\(\d+,\d+\)$/.test(normalizedType);
}

/**
 * Validates a DatabaseSchema structure and throws an Error when validations fail
 * 
 * Validations:
 * - Detects duplicate tables
 * - Detects duplicate columns within each table
 * - Detects multiple primary keys in a table
 * - Validates that column types are valid
 * - Validates that foreign keys reference existing tables and columns
 * 
 * @param schema - The DatabaseSchema to validate
 * @throws Error with a descriptive message if validation rules are violated
 */
export function validateSchema(schema: DatabaseSchema): void {
  validateDuplicateTables(schema);

  // Validate each table
  for (const tableName in schema.tables) {
    const table = schema.tables[tableName];
    validateTableColumns(tableName, table, schema.tables);
  }
}

/**
 * Validates that there are no duplicate tables in the schema
 * 
 * @param schema - The DatabaseSchema to validate
 * @throws Error if duplicate tables are detected
 */
function validateDuplicateTables(schema: DatabaseSchema): void {
  const tableNames = Object.keys(schema.tables);
  const seen = new Set<string>();

  for (const tableName of tableNames) {
    if (seen.has(tableName)) {
      throw new Error(`Duplicate table: '${tableName}'`);
    }
    seen.add(tableName);
  }
}

/**
 * Validates columns, primary keys, types, and foreign keys within a table
 * 
 * @param tableName - Table name
 * @param table - The table to validate
 * @param allTables - All schema tables (used to validate foreign keys)
 * @throws Error if validation violations are detected
 */
function validateTableColumns(tableName: string, table: Table, allTables: Record<string, Table>): void {
  // Validate duplicate columns
  const columnNames = new Set<string>();
  const primaryKeyColumns: string[] = [];

  for (const column of table.columns) {
    // Check for duplicate columns
    if (columnNames.has(column.name)) {
      throw new Error(`Table '${tableName}': duplicate column '${column.name}'`);
    }
    columnNames.add(column.name);

    // Count primary keys
    if (column.primaryKey) {
      primaryKeyColumns.push(column.name);
    }

    // Validate column type
    if (!isValidColumnType(column.type)) {
      throw new Error(
        `Table '${tableName}', column '${column.name}': type '${column.type}' is not valid. Supported types: ${VALID_BASE_COLUMN_TYPES.join(', ')}, varchar(n), numeric(p,s)`
      );
    }

    // Validate foreign key
    if (column.foreignKey) {
      const fkTable = column.foreignKey.table;
      const fkColumn = column.foreignKey.column;

      // Check that the referenced table exists
      if (!allTables[fkTable]) {
        throw new Error(
          `Table '${tableName}', column '${column.name}': referenced table '${fkTable}' does not exist`
        );
      }

      // Check that the column exists in the referenced table
      const referencedTable = allTables[fkTable];
      const columnExists = referencedTable.columns.some(col => col.name === fkColumn);

      if (!columnExists) {
        throw new Error(
          `Table '${tableName}', column '${column.name}': table '${fkTable}' does not have column '${fkColumn}'`
        );
      }
    }
  }

  // Validate multiple primary keys
  if (primaryKeyColumns.length > 1) {
    throw new Error(`Table '${tableName}': can only have one primary key (found ${primaryKeyColumns.length})`);
  }

  const normalizedPrimaryKey = table.primaryKey ?? primaryKeyColumns[0] ?? null;

  if (table.primaryKey && !columnNames.has(table.primaryKey)) {
    throw new Error(
      `Table '${tableName}': primary key column '${table.primaryKey}' does not exist`
    );
  }

  if (
    table.primaryKey &&
    primaryKeyColumns.length === 1 &&
    primaryKeyColumns[0] !== table.primaryKey
  ) {
    throw new Error(
      `Table '${tableName}': column-level primary key '${primaryKeyColumns[0]}' does not match table primary key '${table.primaryKey}'`
    );
  }

  if (normalizedPrimaryKey) {
    const pkMatches = table.columns.filter(column => column.name === normalizedPrimaryKey);
    if (pkMatches.length !== 1) {
      throw new Error(
        `Table '${tableName}': primary key column '${normalizedPrimaryKey}' is invalid`
      );
    }
  }
}
