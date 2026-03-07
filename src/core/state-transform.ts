import type {
  DatabaseSchema,
  StateColumn,
  StateFile,
  StateTable,
} from '../types/schema.js';

/**
 * Convert a DatabaseSchema to a StateFile (in-memory only).
 * Transforms table columns from array to indexed Record format.
 * Safe for browser; no Node/fs usage.
 */
export async function schemaToState(schema: DatabaseSchema): Promise<StateFile> {
  const tables: Record<string, StateTable> = {};

  for (const [tableName, table] of Object.entries(schema.tables)) {
    const columns: Record<string, StateColumn> = {};
    const primaryKeyColumn =
      table.primaryKey ?? table.columns.find(column => column.primaryKey)?.name ?? null;

    for (const column of table.columns) {
      columns[column.name] = {
        type: column.type,
        ...(column.primaryKey !== undefined && { primaryKey: column.primaryKey }),
        ...(column.unique !== undefined && { unique: column.unique }),
        nullable: column.nullable ?? true,
        ...(column.default !== undefined && { default: column.default }),
        ...(column.foreignKey !== undefined && { foreignKey: column.foreignKey }),
      };
    }

    tables[tableName] = {
      columns,
      ...(primaryKeyColumn !== null && { primaryKey: primaryKeyColumn }),
    };
  }

  return {
    version: 1,
    tables,
  };
}
