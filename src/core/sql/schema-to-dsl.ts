import type { DatabaseSchema, PolicyNode } from '../../types/schema.js';

function renderColumn(column: {
  name: string;
  type: string;
  primaryKey?: boolean;
  unique?: boolean;
  nullable?: boolean;
  default?: string | null;
}): string {
  const parts: string[] = [column.name, column.type];

  if (column.primaryKey) {
    parts.push('pk');
  }

  if (column.unique) {
    parts.push('unique');
  }

  if (column.nullable === false && !column.primaryKey) {
    parts.push('not null');
  }

  if (column.default !== undefined && column.default !== null) {
    parts.push(`default ${column.default}`);
  }

  return `  ${parts.join(' ')}`;
}

function renderPolicy(policy: PolicyNode): string {
  const lines: string[] = [
    `policy "${policy.name}" on ${policy.table}`,
    `for ${policy.command}`
  ];
  if (policy.to !== undefined && policy.to.length > 0) {
    lines.push(`to ${policy.to.join(' ')}`);
  }
  if (policy.using !== undefined && policy.using !== '') {
    lines.push(`using ${policy.using}`);
  }
  if (policy.withCheck !== undefined && policy.withCheck !== '') {
    lines.push(`with check ${policy.withCheck}`);
  }
  return lines.join('\n');
}

export function schemaToDsl(schema: DatabaseSchema): string {
  const tableNames = Object.keys(schema.tables).sort((left, right) => left.localeCompare(right));

  const blocks: string[] = [];
  for (const tableName of tableNames) {
    const table = schema.tables[tableName];
    const tableLines: string[] = [`table ${table.name} {`];

    for (const column of table.columns) {
      tableLines.push(renderColumn(column as any));
    }

    tableLines.push('}');
    blocks.push(tableLines.join('\n'));

    if (table.policies?.length) {
      for (const policy of table.policies) {
        blocks.push(renderPolicy(policy));
      }
    }
  }

  if (blocks.length === 0) {
    return '# SchemaForge schema definition\n';
  }

  return `# SchemaForge schema definition\n\n${blocks.join('\n\n')}\n`;
}
