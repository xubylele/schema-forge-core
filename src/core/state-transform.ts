import type {
  DatabaseSchema,
  StateColumn,
  StateFile,
  StateIndex,
  StatePolicy,
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

    let policies: Record<string, StatePolicy> | undefined;
    if (table.policies?.length) {
      policies = {};
      for (const p of table.policies) {
        policies[p.name] = {
          command: p.command,
          ...(p.using !== undefined && { using: p.using }),
          ...(p.withCheck !== undefined && { withCheck: p.withCheck }),
        };
      }
    }

    let indexes: Record<string, StateIndex> | undefined;
    if (table.indexes?.length) {
      indexes = {};
      for (const index of table.indexes) {
        indexes[index.name] = {
          name: index.name,
          table: index.table,
          columns: [...index.columns],
          unique: index.unique,
          ...(index.where !== undefined && { where: index.where }),
          ...(index.expression !== undefined && { expression: index.expression }),
        };
      }
    }

    tables[tableName] = {
      columns,
      ...(primaryKeyColumn !== null && { primaryKey: primaryKeyColumn }),
      ...(indexes !== undefined && { indexes }),
      ...(policies !== undefined && { policies }),
    };
  }

  return {
    version: 1,
    tables,
  };
}
