import type {
  DatabaseSchema,
  StateColumn,
  StateFile,
  StatePolicy,
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

    let policies: Record<string, StatePolicy> | undefined;
    if (table.policies?.length) {
      policies = {};
      for (const p of table.policies) {
        policies[p.name] = {
          command: p.command,
          ...(p.using !== undefined && { using: p.using }),
          ...(p.withCheck !== undefined && { withCheck: p.withCheck }),
          ...(p.to !== undefined && p.to.length > 0 && { to: p.to }),
        };
      }
    }

    tables[tableName] = {
      columns,
      ...(policies !== undefined && { policies }),
    };
  }

  return {
    version: 1,
    tables,
  };
}
