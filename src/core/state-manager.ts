import path from 'path';
import type {
  DatabaseSchema,
  StateColumn,
  StateFile,
  StateTable
} from '../types/schema.js';
import { ensureDir, readJsonFile, writeJsonFile } from './fs.js';

/**
 * Convert a DatabaseSchema to a StateFile
 * Transforms table columns from array to indexed Record format
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

/**
 * Load state from disk
 * Returns fallback { version: 1, tables: {} } if file doesn't exist
 */
export async function loadState(statePath: string): Promise<StateFile> {
  return await readJsonFile<StateFile>(statePath, { version: 1, tables: {} });
}

/**
 * Save state to disk
 * Creates parent directories automatically if they don't exist
 */
export async function saveState(statePath: string, state: StateFile): Promise<void> {
  const dirPath = path.dirname(statePath);
  await ensureDir(dirPath);
  await writeJsonFile(statePath, state);
}
