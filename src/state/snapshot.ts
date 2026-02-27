import type {
  DatabaseSchema,
  StateColumn,
  StateFile,
  StateTable,
} from '../types/schema.js';

export function createSnapshot(schema: DatabaseSchema): StateFile {
  const tables: Record<string, StateTable> = {};

  for (const [tableName, table] of Object.entries(schema.tables)) {
    const columns: Record<string, StateColumn> = {};

    for (const column of table.columns) {
      columns[column.name] = {
        type: column.type,
        ...(column.primaryKey !== undefined && { primaryKey: column.primaryKey }),
        ...(column.unique !== undefined && { unique: column.unique }),
        ...(column.nullable !== undefined && { nullable: column.nullable }),
        ...(column.default !== undefined && { default: column.default }),
        ...(column.foreignKey !== undefined && { foreignKey: column.foreignKey }),
      };
    }

    tables[tableName] = { columns };
  }

  return {
    version: 1,
    tables,
  };
}
