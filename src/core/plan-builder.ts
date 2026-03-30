import type { DiffResult, Operation } from '../types/schema.js';

export type MigrationPlanAction = 'create' | 'modify' | 'delete';
export type MigrationPlanSymbol = '+' | '~' | '-';

export interface MigrationPlanEntry {
  action: MigrationPlanAction;
  symbol: MigrationPlanSymbol;
  operationKind: Operation['kind'];
  summary: string;
  tableName?: string;
  columnName?: string;
  from?: string | boolean | null;
  to?: string | boolean | null;
}

export interface MigrationPlanResult {
  entries: MigrationPlanEntry[];
  lines: string[];
}

function toAction(operation: Operation): MigrationPlanAction {
  switch (operation.kind) {
    case 'create_table':
    case 'add_column':
    case 'add_primary_key_constraint':
    case 'create_index':
    case 'create_policy':
    case 'create_view':
      return 'create';

    case 'drop_table':
    case 'drop_column':
    case 'drop_primary_key_constraint':
    case 'drop_index':
    case 'drop_policy':
    case 'drop_view':
      return 'delete';

    case 'column_type_changed':
    case 'column_nullability_changed':
    case 'column_default_changed':
    case 'column_unique_changed':
    case 'modify_policy':
    case 'replace_view':
      return 'modify';

    default: {
      const exhaustiveCheck: never = operation;
      return exhaustiveCheck;
    }
  }
}

function actionToSymbol(action: MigrationPlanAction): MigrationPlanSymbol {
  if (action === 'create') {
    return '+';
  }
  if (action === 'modify') {
    return '~';
  }
  return '-';
}

function formatNullable(value: boolean): string {
  return value ? 'nullable' : 'not null';
}

function formatUnique(value: boolean): string {
  return value ? 'unique' : 'not unique';
}

function formatDefault(value: string | null): string {
  if (value === null) {
    return 'null';
  }
  return value;
}

function toEntry(operation: Operation): MigrationPlanEntry {
  const action = toAction(operation);
  const symbol = actionToSymbol(action);

  switch (operation.kind) {
    case 'create_table':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `create table ${operation.table.name}`,
        tableName: operation.table.name,
      };

    case 'drop_table':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `drop table ${operation.tableName}`,
        tableName: operation.tableName,
      };

    case 'add_column':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `add column ${operation.column.name} to ${operation.tableName}`,
        tableName: operation.tableName,
        columnName: operation.column.name,
      };

    case 'drop_column':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `drop column ${operation.columnName} from ${operation.tableName}`,
        tableName: operation.tableName,
        columnName: operation.columnName,
      };

    case 'column_type_changed':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `modify column ${operation.columnName} type on ${operation.tableName} (${operation.fromType} -> ${operation.toType})`,
        tableName: operation.tableName,
        columnName: operation.columnName,
        from: operation.fromType,
        to: operation.toType,
      };

    case 'column_nullability_changed':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `modify column ${operation.columnName} nullability on ${operation.tableName} (${formatNullable(operation.from)} -> ${formatNullable(operation.to)})`,
        tableName: operation.tableName,
        columnName: operation.columnName,
        from: operation.from,
        to: operation.to,
      };

    case 'column_default_changed':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `modify column ${operation.columnName} default on ${operation.tableName} (${formatDefault(operation.fromDefault)} -> ${formatDefault(operation.toDefault)})`,
        tableName: operation.tableName,
        columnName: operation.columnName,
        from: operation.fromDefault,
        to: operation.toDefault,
      };

    case 'column_unique_changed':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `modify column ${operation.columnName} unique constraint on ${operation.tableName} (${formatUnique(operation.from)} -> ${formatUnique(operation.to)})`,
        tableName: operation.tableName,
        columnName: operation.columnName,
        from: operation.from,
        to: operation.to,
      };

    case 'drop_primary_key_constraint':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `drop primary key constraint on ${operation.tableName}`,
        tableName: operation.tableName,
      };

    case 'add_primary_key_constraint':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `add primary key constraint on ${operation.tableName} (${operation.columnName})`,
        tableName: operation.tableName,
        columnName: operation.columnName,
      };

    case 'create_index':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `create index ${operation.index.name} on ${operation.tableName}`,
        tableName: operation.tableName,
      };

    case 'drop_index':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `drop index ${operation.index.name} on ${operation.tableName}`,
        tableName: operation.tableName,
      };

    case 'create_policy':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `create policy ${operation.policy.name} on ${operation.tableName}`,
        tableName: operation.tableName,
      };

    case 'drop_policy':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `drop policy ${operation.policyName} on ${operation.tableName}`,
        tableName: operation.tableName,
      };

    case 'modify_policy':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `modify policy ${operation.policyName} on ${operation.tableName}`,
        tableName: operation.tableName,
      };

    case 'create_view':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `create view ${operation.view.name}`,
      };

    case 'drop_view':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `drop view ${operation.viewName}`,
      };

    case 'replace_view':
      return {
        action,
        symbol,
        operationKind: operation.kind,
        summary: `replace view ${operation.view.name}`,
      };

    default: {
      const exhaustiveCheck: never = operation;
      return exhaustiveCheck;
    }
  }
}

export function formatMigrationPlanLine(entry: MigrationPlanEntry): string {
  return `${entry.symbol} ${entry.summary}`;
}

export function formatMigrationPlanLines(entries: MigrationPlanEntry[]): string[] {
  return entries.map(formatMigrationPlanLine);
}

export function buildMigrationPlan(diff: DiffResult): MigrationPlanResult {
  const entries = diff.operations.map(toEntry);
  return {
    entries,
    lines: formatMigrationPlanLines(entries),
  };
}
