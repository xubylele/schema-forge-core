import type {
  Column,
  DatabaseSchema,
  DiffResult,
  Operation,
  StateColumn,
  StateFile,
} from '../types/schema';

export function getTableNamesFromState(state: StateFile): Set<string> {
  return new Set(Object.keys(state.tables));
}

export function getTableNamesFromSchema(schema: DatabaseSchema): Set<string> {
  return new Set(Object.keys(schema.tables));
}

export function getColumnNamesFromState(
  stateColumns: Record<string, StateColumn>
): Set<string> {
  return new Set(Object.keys(stateColumns));
}

export function getColumnNamesFromSchema(dbColumns: Column[]): Set<string> {
  return new Set(dbColumns.map(column => column.name));
}

function getSortedNames(names: Set<string>): string[] {
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

export function diffSchemas(oldSnapshot: StateFile, newSchema: DatabaseSchema): DiffResult {
  const operations: Operation[] = [];

  const oldTableNames = getTableNamesFromState(oldSnapshot);
  const newTableNames = getTableNamesFromSchema(newSchema);

  const sortedNewTableNames = getSortedNames(newTableNames);
  const sortedOldTableNames = getSortedNames(oldTableNames);

  for (const tableName of sortedNewTableNames) {
    if (!oldTableNames.has(tableName)) {
      operations.push({
        kind: 'create_table',
        table: newSchema.tables[tableName],
      });
    }
  }

  const commonTableNames = sortedNewTableNames.filter(tableName =>
    oldTableNames.has(tableName)
  );

  for (const tableName of commonTableNames) {
    const newTable = newSchema.tables[tableName];
    const oldTable = oldSnapshot.tables[tableName];

    if (!newTable || !oldTable) {
      continue;
    }

    const oldColumnNames = getColumnNamesFromState(oldTable.columns);

    for (const column of newTable.columns) {
      if (!oldColumnNames.has(column.name)) {
        operations.push({
          kind: 'add_column',
          tableName,
          column,
        });
      }
    }
  }

  for (const tableName of commonTableNames) {
    const newTable = newSchema.tables[tableName];
    const oldTable = oldSnapshot.tables[tableName];

    if (!newTable || !oldTable) {
      continue;
    }

    const newColumnNames = getColumnNamesFromSchema(newTable.columns);

    for (const columnName of Object.keys(oldTable.columns)) {
      if (!newColumnNames.has(columnName)) {
        operations.push({
          kind: 'drop_column',
          tableName,
          columnName,
        });
      }
    }
  }

  for (const tableName of sortedOldTableNames) {
    if (!newTableNames.has(tableName)) {
      operations.push({
        kind: 'drop_table',
        tableName,
      });
    }
  }

  return { operations };
}
