import type {
  Column,
  DatabaseSchema,
  DiffResult,
  Operation,
  PolicyNode,
  StateColumn,
  StateFile,
  StatePolicy,
} from '../types/schema.js';
import { normalizeDefault } from './normalize.js';

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

/**
 * Compare a persisted state and a new schema, generating ordered operations.
 */
export function diffSchemas(oldState: StateFile, newSchema: DatabaseSchema): DiffResult {
  const operations: Operation[] = [];

  const oldTableNames = getTableNamesFromState(oldState);
  const newTableNames = getTableNamesFromSchema(newSchema);

  const sortedNewTableNames = getSortedNames(newTableNames);
  const sortedOldTableNames = getSortedNames(oldTableNames);

  // Phase 1: create tables (A-Z)
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

  // Phase 2: detect column type changes in schema order
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

  // Phase 3: drop PK constraints for changed/removed primary keys
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

  // Phase 4: detect unique changes for existing columns in schema order
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

  // Phase 5: detect column nullability changes in schema order
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

  // Phase 6: detect column default changes in schema order
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

  // Phase 7: add columns in schema order
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

  // Phase 8: add PK constraints for added/changed primary keys
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

  // Phase 9: drop columns in state key order
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

  // Phase 9.5: policy diff (create, modify, drop) for common tables only
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

  // Phase 10: drop tables (A-Z)
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
