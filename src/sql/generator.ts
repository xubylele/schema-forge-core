import { Column, DiffResult, Operation, Table } from '../types/schema.types';

export function generateSQL(diff: DiffResult): string {
  const statements: string[] = [];

  for (const operation of diff.operations) {
    const sql = generateOperation(operation);
    if (sql) {
      statements.push(sql);
    }
  }

  return statements.join('\n\n');
}

function generateOperation(operation: Operation): string {
  switch (operation.kind) {
    case 'create_table':
      return generateCreateTable(operation.table);
    case 'drop_table':
      return generateDropTable(operation.tableName);
    case 'add_column':
      return generateAddColumn(operation.tableName, operation.column);
    case 'drop_column':
      return generateDropColumn(operation.tableName, operation.columnName);
  }
}

function generateCreateTable(table: Table): string {
  const columnDefs = table.columns.map(col => generateColumnDefinition(col));

  const lines = ['CREATE TABLE ' + table.name + ' ('];
  columnDefs.forEach((colDef, index) => {
    const isLast = index === columnDefs.length - 1;
    lines.push('  ' + colDef + (isLast ? '' : ','));
  });
  lines.push(');');

  return lines.join('\n');
}

function generateColumnDefinition(column: Column): string {
  const parts: string[] = [column.name, column.type];

  if (column.foreignKey) {
    parts.push(
      `references ${column.foreignKey.table}(${column.foreignKey.column})`
    );
  }

  if (column.primaryKey) {
    parts.push('primary key');
  }

  if (column.unique) {
    parts.push('unique');
  }

  if (column.nullable === false) {
    parts.push('not null');
  }

  if (column.default !== undefined) {
    parts.push('default ' + column.default);
  }

  return parts.join(' ');
}

function generateDropTable(tableName: string): string {
  return `DROP TABLE ${tableName};`;
}

function generateAddColumn(tableName: string, column: Column): string {
  const colDef = generateColumnDefinition(column);
  return `ALTER TABLE ${tableName} ADD COLUMN ${colDef};`;
}

function generateDropColumn(tableName: string, columnName: string): string {
  return `ALTER TABLE ${tableName} DROP COLUMN ${columnName};`;
}
