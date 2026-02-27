import type { DatabaseSchema, Table } from '../../types/schema.js';
import type { ApplySqlOpsResult, ParseWarning, ParsedColumn, ParsedConstraint, SqlOp } from '../../types/sql.js';

function toSchemaColumn(column: ParsedColumn) {
  return {
    name: column.name,
    type: column.type as any,
    nullable: column.nullable,
    ...(column.default !== undefined ? { default: column.default } : {}),
    ...(column.unique !== undefined ? { unique: column.unique } : {}),
    ...(column.primaryKey !== undefined ? { primaryKey: column.primaryKey } : {})
  };
}

function applySingleColumnConstraint(table: Table, constraint: ParsedConstraint): boolean {
  if (constraint.columns.length !== 1) {
    return false;
  }

  const targetColumn = table.columns.find(column => column.name === constraint.columns[0]);
  if (!targetColumn) {
    return false;
  }

  if (constraint.type === 'PRIMARY_KEY') {
    table.primaryKey = targetColumn.name;
    targetColumn.primaryKey = true;
    targetColumn.nullable = false;
    return true;
  }

  targetColumn.unique = true;
  return true;
}

function clearConstraintByName(table: Table, name: string): void {
  if (name.endsWith('_pkey') || name.startsWith('pk_')) {
    if (table.primaryKey) {
      const pkColumn = table.columns.find(column => column.name === table.primaryKey);
      if (pkColumn) {
        pkColumn.primaryKey = false;
      }
      table.primaryKey = null;
    }
    return;
  }

  if (name.endsWith('_key') || name.startsWith('uq_')) {
    for (const column of table.columns) {
      if (column.unique) {
        column.unique = false;
      }
    }
  }
}

function getOrCreateTable(tables: Record<string, Table>, name: string): Table {
  if (!tables[name]) {
    tables[name] = { name, columns: [] };
  }
  return tables[name];
}

export function applySqlOps(ops: SqlOp[]): ApplySqlOpsResult {
  const tables: Record<string, Table> = {};
  const warnings: ParseWarning[] = [];

  for (const op of ops) {
    switch (op.kind) {
      case 'CREATE_TABLE': {
        const table: Table = {
          name: op.table,
          columns: op.columns.map(toSchemaColumn)
        };

        for (const column of table.columns) {
          if (column.primaryKey) {
            table.primaryKey = column.name;
          }
        }

        for (const constraint of op.constraints) {
          const applied = applySingleColumnConstraint(table, constraint);
          if (!applied) {
            warnings.push({
              statement: `CREATE TABLE ${op.table}`,
              reason: `Constraint ${constraint.type}${constraint.name ? ` (${constraint.name})` : ''} is unsupported for schema reconstruction`
            });
          }
        }

        tables[op.table] = table;
        break;
      }

      case 'ADD_COLUMN': {
        const table = getOrCreateTable(tables, op.table);
        table.columns = table.columns.filter(column => column.name !== op.column.name);
        table.columns.push(toSchemaColumn(op.column));
        if (op.column.primaryKey) {
          table.primaryKey = op.column.name;
        }
        break;
      }

      case 'ALTER_COLUMN_TYPE': {
        const table = tables[op.table];
        if (!table) {
          break;
        }
        const column = table.columns.find(item => item.name === op.column);
        if (column) {
          column.type = op.toType as any;
        }
        break;
      }

      case 'SET_NOT_NULL': {
        const table = tables[op.table];
        const column = table?.columns.find(item => item.name === op.column);
        if (column) {
          column.nullable = false;
        }
        break;
      }

      case 'DROP_NOT_NULL': {
        const table = tables[op.table];
        const column = table?.columns.find(item => item.name === op.column);
        if (column) {
          column.nullable = true;
        }
        break;
      }

      case 'SET_DEFAULT': {
        const table = tables[op.table];
        const column = table?.columns.find(item => item.name === op.column);
        if (column) {
          column.default = op.expr;
        }
        break;
      }

      case 'DROP_DEFAULT': {
        const table = tables[op.table];
        const column = table?.columns.find(item => item.name === op.column);
        if (column) {
          column.default = null;
        }
        break;
      }

      case 'ADD_CONSTRAINT': {
        const table = tables[op.table];
        if (!table) {
          break;
        }
        const applied = applySingleColumnConstraint(table, op.constraint);
        if (!applied) {
          warnings.push({
            statement: `ALTER TABLE ${op.table} ADD CONSTRAINT ${op.constraint.name ?? '<unnamed>'}`,
            reason: `Constraint ${op.constraint.type} is unsupported for schema reconstruction`
          });
        }
        break;
      }

      case 'DROP_CONSTRAINT': {
        const table = tables[op.table];
        if (!table) {
          break;
        }
        clearConstraintByName(table, op.name);
        break;
      }

      case 'DROP_COLUMN': {
        const table = tables[op.table];
        if (!table) {
          break;
        }
        table.columns = table.columns.filter(column => column.name !== op.column);
        if (table.primaryKey === op.column) {
          table.primaryKey = null;
        }
        break;
      }

      case 'DROP_TABLE': {
        delete tables[op.table];
        break;
      }
    }
  }

  const schema: DatabaseSchema = { tables };
  return { schema, warnings };
}
