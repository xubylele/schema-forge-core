import type {
  Column,
  DatabaseSchema,
  DiffResult,
  IndexNode,
  Operation,
  PolicyNode,
  StateColumn,
  StateFile,
  StateIndex,
  StatePolicy,
} from '../types/schema.js';
import { deterministicIndexName, normalizeDefault, normalizeSqlExpression } from './normalize.js';

/**
 * Extract table names from a stored state file.
 */
export function getTableNamesFromState(state: StateFile): Set<string> {
  return new Set(Object.keys(state.tables));
}

/**
 * Extract table names from a database schema.
 */
export function getTableNamesFromSchema(schema: DatabaseSchema): Set<string> {
  return new Set(Object.keys(schema.tables));
}

/**
 * Extract column names from a state table columns record.
 */
export function getColumnNamesFromState(
  stateColumns: Record<string, StateColumn>
): Set<string> {
  return new Set(Object.keys(stateColumns));
}

/**
 * Extract column names from a schema table columns array.
 */
export function getColumnNamesFromSchema(dbColumns: Column[]): Set<string> {
  return new Set(dbColumns.map(column => column.name));
}

function getSortedNames(names: Set<string>): string[] {
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function normalizeColumnType(type: string): string {
  return type
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*\)\s*/g, ')');
}

function resolveStatePrimaryKey(table: StateFile['tables'][string]): string | null {
  return table.primaryKey ??
    Object.entries(table.columns).find(([, column]) => column.primaryKey)?.[0] ??
    null;
}

function resolveSchemaPrimaryKey(table: DatabaseSchema['tables'][string]): string | null {
  return table.primaryKey ?? table.columns.find(column => column.primaryKey)?.name ?? null;
}

function normalizeNullable(nullable?: boolean): boolean {
  return nullable ?? true;
}

function normalizePolicyExpression(s?: string): string {
  return (s ?? '').trim().replace(/\s+/g, ' ');
}

function policyEquals(oldP: StatePolicy, newP: PolicyNode): boolean {
  if (oldP.command !== newP.command) return false;
  if (normalizePolicyExpression(oldP.using) !== normalizePolicyExpression(newP.using)) return false;
  if (normalizePolicyExpression(oldP.withCheck) !== normalizePolicyExpression(newP.withCheck)) return false;
  const oldTo = (oldP.to ?? []).slice().sort().join(',');
  const newTo = (newP.to ?? []).slice().sort().join(',');
  if (oldTo !== newTo) return false;
  return true;
}

function resolveSchemaIndexName(index: IndexNode): string {
  if (index.name && index.name.trim().length > 0) {
    return index.name.trim();
  }

  return deterministicIndexName({
    table: index.table,
    columns: index.columns,
    expression: index.expression,
  });
}

function resolveStateIndexName(index: StateIndex): string {
  if (index.name && index.name.trim().length > 0) {
    return index.name.trim();
  }

  return deterministicIndexName({
    table: index.table,
    columns: index.columns,
    expression: index.expression,
  });
}

function normalizeIndexWhere(value?: string): string {
  return normalizeSqlExpression(value);
}

function normalizeIndexExpression(value?: string): string {
  return normalizeSqlExpression(value);
}

function indexesEqual(previous: StateIndex, current: IndexNode): boolean {
  if (previous.table !== current.table) return false;
  if ((previous.unique ?? false) !== (current.unique ?? false)) return false;

  if (previous.columns.length !== current.columns.length) return false;
  for (let index = 0; index < previous.columns.length; index++) {
    if (previous.columns[index] !== current.columns[index]) {
      return false;
    }
  }

  if (normalizeIndexWhere(previous.where) !== normalizeIndexWhere(current.where)) return false;
  if (normalizeIndexExpression(previous.expression) !== normalizeIndexExpression(current.expression)) return false;

  return true;
}

/**
 * Compare a persisted state and a new schema, generating ordered operations.
 */
export function diffSchemas(oldState: StateFile, newSchema: DatabaseSchema): DiffResult {
  const operations: Operation[] = [];

  const oldTableNames = getTableNamesFromState(oldState);
  const newTableNames = getTableNamesFromSchema(newSchema);

  const sortedNewTableNames = getSortedNames(newTableNames);
  const sortedOldTableNames = getSortedNames(oldTableNames);

  for (const tableName of sortedNewTableNames) {
    if (!oldTableNames.has(tableName)) {
      operations.push({
        kind: 'create_table',
        table: newSchema.tables[tableName],
      });

      const createdTable = newSchema.tables[tableName];
      const createdIndexes = (createdTable.indexes ?? [])
        .map(index => ({ ...index, name: resolveSchemaIndexName(index) }))
        .sort((left, right) => left.name.localeCompare(right.name));

      for (const index of createdIndexes) {
        operations.push({
          kind: 'create_index',
          tableName,
          index,
        });
      }
    }
  }

  const commonTableNames = sortedNewTableNames.filter(tableName =>
    oldTableNames.has(tableName)
  );

  for (const tableName of commonTableNames) {
    const newTable = newSchema.tables[tableName];
    const oldTable = oldState.tables[tableName];

    if (!newTable || !oldTable) {
      continue;
    }

    for (const column of newTable.columns) {
      const previousColumn = oldTable.columns[column.name];
      if (!previousColumn) {
        continue;
      }

      const previousType = normalizeColumnType(previousColumn.type);
      const currentType = normalizeColumnType(column.type);

      if (previousType !== currentType) {
        operations.push({
          kind: 'column_type_changed',
          tableName,
          columnName: column.name,
          fromType: previousColumn.type,
          toType: column.type,
        });
      }
    }
  }

  for (const tableName of commonTableNames) {
    const newTable = newSchema.tables[tableName];
    const oldTable = oldState.tables[tableName];

    if (!newTable || !oldTable) {
      continue;
    }

    const previousPrimaryKey = resolveStatePrimaryKey(oldTable);
    const currentPrimaryKey = resolveSchemaPrimaryKey(newTable);

    if (previousPrimaryKey !== null && previousPrimaryKey !== currentPrimaryKey) {
      operations.push({
        kind: 'drop_primary_key_constraint',
        tableName,
      });
    }
  }

  for (const tableName of commonTableNames) {
    const newTable = newSchema.tables[tableName];
    const oldTable = oldState.tables[tableName];

    if (!newTable || !oldTable) {
      continue;
    }

    for (const column of newTable.columns) {
      const previousColumn = oldTable.columns[column.name];
      if (!previousColumn) {
        continue;
      }

      const previousUnique = previousColumn.unique ?? false;
      const currentUnique = column.unique ?? false;

      if (previousUnique !== currentUnique) {
        operations.push({
          kind: 'column_unique_changed',
          tableName,
          columnName: column.name,
          from: previousUnique,
          to: currentUnique,
        });
      }
    }
  }

  for (const tableName of commonTableNames) {
    const newTable = newSchema.tables[tableName];
    const oldTable = oldState.tables[tableName];

    if (!newTable || !oldTable) {
      continue;
    }

    for (const column of newTable.columns) {
      const previousColumn = oldTable.columns[column.name];
      if (!previousColumn) {
        continue;
      }

      const previousNullable = normalizeNullable(previousColumn.nullable);
      const currentNullable = normalizeNullable(column.nullable);

      if (previousNullable !== currentNullable) {
        operations.push({
          kind: 'column_nullability_changed',
          tableName,
          columnName: column.name,
          from: previousNullable,
          to: currentNullable,
        });
      }
    }
  }

  for (const tableName of commonTableNames) {
    const newTable = newSchema.tables[tableName];
    const oldTable = oldState.tables[tableName];

    if (!newTable || !oldTable) {
      continue;
    }

    for (const column of newTable.columns) {
      const previousColumn = oldTable.columns[column.name];
      if (!previousColumn) {
        continue;
      }

      const previousDefault = normalizeDefault(previousColumn.default);
      const currentDefault = normalizeDefault(column.default);

      if (previousDefault !== currentDefault) {
        operations.push({
          kind: 'column_default_changed',
          tableName,
          columnName: column.name,
          fromDefault: previousDefault,
          toDefault: currentDefault,
        });
      }
    }
  }

  for (const tableName of commonTableNames) {
    const newTable = newSchema.tables[tableName];
    const oldTable = oldState.tables[tableName];

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
    const oldTable = oldState.tables[tableName];

    if (!newTable || !oldTable) {
      continue;
    }

    const previousPrimaryKey = resolveStatePrimaryKey(oldTable);
    const currentPrimaryKey = resolveSchemaPrimaryKey(newTable);

    if (currentPrimaryKey !== null && previousPrimaryKey !== currentPrimaryKey) {
      operations.push({
        kind: 'add_primary_key_constraint',
        tableName,
        columnName: currentPrimaryKey,
      });
    }
  }

  for (const tableName of commonTableNames) {
    const newTable = newSchema.tables[tableName];
    const oldTable = oldState.tables[tableName];

    if (!newTable || !oldTable) {
      continue;
    }

    const oldIndexes = oldTable.indexes ?? {};
    const newIndexesByName = new Map<string, IndexNode>();
    for (const index of newTable.indexes ?? []) {
      const resolved = { ...index, name: resolveSchemaIndexName(index) };
      newIndexesByName.set(resolved.name, resolved);
    }

    const oldIndexesByName = new Map<string, StateIndex>();
    for (const oldIndex of Object.values(oldIndexes)) {
      oldIndexesByName.set(resolveStateIndexName(oldIndex), oldIndex);
    }

    const oldIndexNames = Array.from(oldIndexesByName.keys()).sort((a, b) => a.localeCompare(b));
    const newIndexNames = Array.from(newIndexesByName.keys()).sort((a, b) => a.localeCompare(b));
    const indexDrops: StateIndex[] = [];
    const indexCreates: IndexNode[] = [];

    for (const oldIndexName of oldIndexNames) {
      const oldIndex = oldIndexesByName.get(oldIndexName);
      if (!oldIndex) {
        continue;
      }
      const nextIndex = newIndexesByName.get(oldIndexName);

      if (!nextIndex) {
        indexDrops.push({ ...oldIndex, name: oldIndexName });
        continue;
      }

      if (!indexesEqual(oldIndex, nextIndex)) {
        indexDrops.push({ ...oldIndex, name: oldIndexName });
      }
    }

    for (const newIndexName of newIndexNames) {
      const newIndex = newIndexesByName.get(newIndexName);
      if (!newIndex) {
        continue;
      }

      const oldIndex = oldIndexesByName.get(newIndexName);
      if (!oldIndex || !indexesEqual(oldIndex, newIndex)) {
        indexCreates.push(newIndex);
      }
    }

    for (const index of indexDrops) {
      operations.push({
        kind: 'drop_index',
        tableName,
        index,
      });
    }

    for (const index of indexCreates) {
      operations.push({
        kind: 'create_index',
        tableName,
        index,
      });
    }
  }

  for (const tableName of commonTableNames) {
    const newTable = newSchema.tables[tableName];
    const oldTable = oldState.tables[tableName];

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

  const oldPolicyNamesByTable = (t: StateFile['tables'][string]) =>
    new Set(Object.keys(t.policies ?? {}));
  const newPolicyListByTable = (t: DatabaseSchema['tables'][string]) =>
    t.policies ?? [];
  for (const tableName of commonTableNames) {
    const newTable = newSchema.tables[tableName];
    const oldTable = oldState.tables[tableName];
    if (!newTable || !oldTable) continue;

    const oldPolicyNames = oldPolicyNamesByTable(oldTable);
    const newPolicies = newPolicyListByTable(newTable);
    const newPolicyNames = new Set(newPolicies.map(p => p.name));
    const sortedNewPolicyNames = Array.from(newPolicyNames).sort((a, b) => a.localeCompare(b));
    const sortedOldPolicyNames = Array.from(oldPolicyNames).sort((a, b) => a.localeCompare(b));

    for (const policyName of sortedNewPolicyNames) {
      const policy = newPolicies.find(p => p.name === policyName);
      if (!policy) continue;
      if (!oldPolicyNames.has(policyName)) {
        operations.push({ kind: 'create_policy', tableName, policy });
      } else {
        const oldP = oldTable.policies?.[policyName];
        if (oldP && !policyEquals(oldP, policy)) {
          operations.push({ kind: 'modify_policy', tableName, policyName, policy });
        }
      }
    }
    for (const policyName of sortedOldPolicyNames) {
      if (!newPolicyNames.has(policyName)) {
        operations.push({ kind: 'drop_policy', tableName, policyName });
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
