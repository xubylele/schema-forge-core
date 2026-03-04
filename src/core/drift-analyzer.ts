import type { DriftReport, StateFile, DatabaseSchema } from '../types/schema.js';

function normalizeColumnType(type: string): string {
  return type
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*\)\s*/g, ')');
}

function getSortedNames(values: Iterable<string>): string[] {
  return Array.from(values).sort((left, right) => left.localeCompare(right));
}

export function analyzeSchemaDrift(state: StateFile, liveSchema: DatabaseSchema): DriftReport {
  const stateTableNames = getSortedNames(Object.keys(state.tables));
  const liveTableNames = getSortedNames(Object.keys(liveSchema.tables));

  const liveTableNameSet = new Set(liveTableNames);
  const stateTableNameSet = new Set(stateTableNames);

  const missingTables = stateTableNames.filter(tableName => !liveTableNameSet.has(tableName));
  const extraTables = liveTableNames.filter(tableName => !stateTableNameSet.has(tableName));

  const commonTableNames = liveTableNames.filter(tableName => stateTableNameSet.has(tableName));

  const columnDifferences: DriftReport['columnDifferences'] = [];
  const typeMismatches: DriftReport['typeMismatches'] = [];

  for (const tableName of commonTableNames) {
    const stateTable = state.tables[tableName];
    const liveTable = liveSchema.tables[tableName];

    if (!stateTable || !liveTable) {
      continue;
    }

    const stateColumnNames = getSortedNames(Object.keys(stateTable.columns));
    const liveColumnsByName = new Map(liveTable.columns.map(column => [column.name, column]));
    const liveColumnNames = getSortedNames(liveColumnsByName.keys());

    const stateColumnNameSet = new Set(stateColumnNames);
    const liveColumnNameSet = new Set(liveColumnNames);

    const missingInLive = stateColumnNames.filter(columnName => !liveColumnNameSet.has(columnName));
    const extraInLive = liveColumnNames.filter(columnName => !stateColumnNameSet.has(columnName));

    if (missingInLive.length > 0 || extraInLive.length > 0) {
      columnDifferences.push({
        tableName,
        missingInLive,
        extraInLive,
      });
    }

    const commonColumns = stateColumnNames.filter(columnName => liveColumnNameSet.has(columnName));
    for (const columnName of commonColumns) {
      const stateColumn = stateTable.columns[columnName];
      const liveColumn = liveColumnsByName.get(columnName);

      if (!stateColumn || !liveColumn) {
        continue;
      }

      const expectedType = stateColumn.type;
      const actualType = liveColumn.type;

      if (normalizeColumnType(expectedType) !== normalizeColumnType(actualType)) {
        typeMismatches.push({
          tableName,
          columnName,
          expectedType,
          actualType,
        });
      }
    }
  }

  return {
    missingTables,
    extraTables,
    columnDifferences,
    typeMismatches,
  };
}
