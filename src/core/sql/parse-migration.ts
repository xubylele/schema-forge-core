import type {
  ParseResult,
  ParseWarning,
  ParsedColumn,
  ParsedConstraint,
  SqlOp
} from '../../types/sql.js';
import { normalizeDefault } from '../normalize.js';
import { splitSqlStatements } from './split-statements.js';

const COLUMN_CONSTRAINT_KEYWORDS = new Set([
  'primary',
  'unique',
  'not',
  'null',
  'default',
  'constraint',
  'references',
  'check'
]);

function normalizeSqlType(type: string): string {
  return type
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*\)\s*/g, ')');
}

function unquoteIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
}

function normalizeIdentifier(identifier: string): string {
  const parts = identifier
    .trim()
    .split('.')
    .map(part => unquoteIdentifier(part))
    .filter(part => part.length > 0);
  const leaf = parts.length > 0 ? parts[parts.length - 1] : identifier.trim();
  return leaf.toLowerCase();
}

function removeSqlComments(statement: string): string {
  let result = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < statement.length; index++) {
    const char = statement[index];
    const next = index + 1 < statement.length ? statement[index + 1] : '';

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        result += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index++;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '-' && next === '-') {
        inLineComment = true;
        index++;
        continue;
      }
      if (char === '/' && next === '*') {
        inBlockComment = true;
        index++;
        continue;
      }
    }

    if (char === "'" && !inDoubleQuote) {
      if (inSingleQuote && next === "'") {
        result += "''";
        index++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      result += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      if (inDoubleQuote && next === '"') {
        result += '""';
        index++;
        continue;
      }
      inDoubleQuote = !inDoubleQuote;
      result += char;
      continue;
    }

    result += char;
  }

  return result.trim();
}

function splitTopLevelComma(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    const next = index + 1 < input.length ? input[index + 1] : '';

    if (char === "'" && !inDoubleQuote) {
      current += char;
      if (inSingleQuote && next === "'") {
        current += next;
        index++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      current += char;
      if (inDoubleQuote && next === '"') {
        current += next;
        index++;
        continue;
      }
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth = Math.max(0, depth - 1);
      } else if (char === ',' && depth === 0) {
        const segment = current.trim();
        if (segment.length > 0) {
          parts.push(segment);
        }
        current = '';
        continue;
      }
    }

    current += char;
  }

  const tail = current.trim();
  if (tail.length > 0) {
    parts.push(tail);
  }

  return parts;
}

function tokenize(segment: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < segment.length; index++) {
    const char = segment[index];
    const next = index + 1 < segment.length ? segment[index + 1] : '';

    if (char === "'" && !inDoubleQuote) {
      current += char;
      if (inSingleQuote && next === "'") {
        current += next;
        index++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      current += char;
      if (inDoubleQuote && next === '"') {
        current += next;
        index++;
        continue;
      }
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth = Math.max(0, depth - 1);
      }

      if (/\s/.test(char) && depth === 0) {
        if (current.length > 0) {
          tokens.push(current);
          current = '';
        }
        continue;
      }
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function parseColumnDefinition(segment: string): ParsedColumn | null {
  const tokens = tokenize(segment);
  if (tokens.length < 2) {
    return null;
  }

  const name = normalizeIdentifier(tokens[0]);
  let cursor = 1;
  const typeTokens: string[] = [];

  while (cursor < tokens.length) {
    const lower = tokens[cursor].toLowerCase();
    if (COLUMN_CONSTRAINT_KEYWORDS.has(lower)) {
      break;
    }
    typeTokens.push(tokens[cursor]);
    cursor++;
  }

  if (typeTokens.length === 0) {
    return null;
  }

  const parsed: ParsedColumn = {
    name,
    type: normalizeSqlType(typeTokens.join(' ')),
    nullable: true
  };

  while (cursor < tokens.length) {
    const lower = tokens[cursor].toLowerCase();

    if (lower === 'primary' && tokens[cursor + 1]?.toLowerCase() === 'key') {
      parsed.primaryKey = true;
      parsed.nullable = false;
      cursor += 2;
      continue;
    }

    if (lower === 'unique') {
      parsed.unique = true;
      cursor++;
      continue;
    }

    if (lower === 'not' && tokens[cursor + 1]?.toLowerCase() === 'null') {
      parsed.nullable = false;
      cursor += 2;
      continue;
    }

    if (lower === 'null') {
      parsed.nullable = true;
      cursor++;
      continue;
    }

    if (lower === 'default') {
      cursor++;
      const defaultTokens: string[] = [];
      while (cursor < tokens.length) {
        const probe = tokens[cursor].toLowerCase();
        if (
          probe === 'constraint' ||
          probe === 'references' ||
          probe === 'check' ||
          (probe === 'not' && tokens[cursor + 1]?.toLowerCase() === 'null') ||
          probe === 'null' ||
          probe === 'unique' ||
          (probe === 'primary' && tokens[cursor + 1]?.toLowerCase() === 'key')
        ) {
          break;
        }
        defaultTokens.push(tokens[cursor]);
        cursor++;
      }
      parsed.default = normalizeDefault(defaultTokens.join(' '));
      continue;
    }

    cursor++;
  }

  return parsed;
}

function parseCreateTableConstraint(segment: string): ParsedConstraint | null {
  const normalized = segment.trim().replace(/\s+/g, ' ');
  const constraintMatch = normalized.match(/^constraint\s+([^\s]+)\s+(primary\s+key|unique)\s*\((.+)\)$/i);
  if (constraintMatch) {
    const [, rawName, kind, rawColumns] = constraintMatch;
    const columns = splitTopLevelComma(rawColumns).map(item => normalizeIdentifier(item));
    if (kind.toLowerCase().includes('primary')) {
      return { type: 'PRIMARY_KEY', name: normalizeIdentifier(rawName), columns };
    }
    return { type: 'UNIQUE', name: normalizeIdentifier(rawName), columns };
  }

  const barePk = normalized.match(/^primary\s+key\s*\((.+)\)$/i);
  if (barePk) {
    const columns = splitTopLevelComma(barePk[1]).map(item => normalizeIdentifier(item));
    return { type: 'PRIMARY_KEY', columns };
  }

  const bareUnique = normalized.match(/^unique\s*\((.+)\)$/i);
  if (bareUnique) {
    const columns = splitTopLevelComma(bareUnique[1]).map(item => normalizeIdentifier(item));
    return { type: 'UNIQUE', columns };
  }

  return null;
}

function parseAlterTablePrefix(stmt: string): { table: string; rest: string } | null {
  const match = stmt.match(/^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(.+)$/i);
  if (!match) {
    return null;
  }

  const remainder = match[1].trim();
  const tokens = tokenize(remainder);
  if (tokens.length < 2) {
    return null;
  }

  const tableToken = tokens[0];
  const table = normalizeIdentifier(tableToken);
  const rest = remainder.slice(tableToken.length).trim();
  return { table, rest };
}

export function parseCreateTable(stmt: string): SqlOp | null {
  const match = stmt.match(/^create\s+table\s+(?:if\s+not\s+exists\s+)?(.+?)\s*\((.*)\)$/is);
  if (!match) {
    return null;
  }

  const table = normalizeIdentifier(match[1]);
  const body = match[2];
  const segments = splitTopLevelComma(body);

  const columns: ParsedColumn[] = [];
  const constraints: ParsedConstraint[] = [];

  for (const segment of segments) {
    const constraint = parseCreateTableConstraint(segment);
    if (constraint) {
      constraints.push(constraint);
      continue;
    }

    const column = parseColumnDefinition(segment);
    if (column) {
      columns.push(column);
    }
  }

  return {
    kind: 'CREATE_TABLE',
    table,
    columns,
    constraints
  };
}

export function parseAlterTableAddColumn(stmt: string): SqlOp | null {
  const prefix = parseAlterTablePrefix(stmt);
  if (!prefix) {
    return null;
  }

  const match = prefix.rest.match(/^add\s+column\s+(?:if\s+not\s+exists\s+)?(.+)$/i);
  if (!match) {
    return null;
  }

  const column = parseColumnDefinition(match[1]);
  if (!column) {
    return null;
  }

  return { kind: 'ADD_COLUMN', table: prefix.table, column };
}

export function parseAlterColumnType(stmt: string): SqlOp | null {
  const prefix = parseAlterTablePrefix(stmt);
  if (!prefix) {
    return null;
  }

  const match = prefix.rest.match(/^alter\s+column\s+([^\s]+)\s+type\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const column = normalizeIdentifier(match[1]);
  const toType = normalizeSqlType(match[2].replace(/\s+using\s+[\s\S]*$/i, '').trim());
  return {
    kind: 'ALTER_COLUMN_TYPE',
    table: prefix.table,
    column,
    toType
  };
}

export function parseSetDropNotNull(stmt: string): SqlOp | null {
  const prefix = parseAlterTablePrefix(stmt);
  if (!prefix) {
    return null;
  }

  const setMatch = prefix.rest.match(/^alter\s+column\s+([^\s]+)\s+set\s+not\s+null$/i);
  if (setMatch) {
    return {
      kind: 'SET_NOT_NULL',
      table: prefix.table,
      column: normalizeIdentifier(setMatch[1])
    };
  }

  const dropMatch = prefix.rest.match(/^alter\s+column\s+([^\s]+)\s+drop\s+not\s+null$/i);
  if (dropMatch) {
    return {
      kind: 'DROP_NOT_NULL',
      table: prefix.table,
      column: normalizeIdentifier(dropMatch[1])
    };
  }

  return null;
}

export function parseSetDropDefault(stmt: string): SqlOp | null {
  const prefix = parseAlterTablePrefix(stmt);
  if (!prefix) {
    return null;
  }

  const setMatch = prefix.rest.match(/^alter\s+column\s+([^\s]+)\s+set\s+default\s+(.+)$/i);
  if (setMatch) {
    return {
      kind: 'SET_DEFAULT',
      table: prefix.table,
      column: normalizeIdentifier(setMatch[1]),
      expr: normalizeDefault(setMatch[2].trim()) ?? setMatch[2].trim()
    };
  }

  const dropMatch = prefix.rest.match(/^alter\s+column\s+([^\s]+)\s+drop\s+default$/i);
  if (dropMatch) {
    return {
      kind: 'DROP_DEFAULT',
      table: prefix.table,
      column: normalizeIdentifier(dropMatch[1])
    };
  }

  return null;
}

export function parseAddDropConstraint(stmt: string): SqlOp | null {
  const prefix = parseAlterTablePrefix(stmt);
  if (!prefix) {
    return null;
  }

  const addMatch = prefix.rest.match(/^add\s+constraint\s+([^\s]+)\s+(primary\s+key|unique)\s*\((.+)\)$/i);
  if (addMatch) {
    const [, rawName, kind, rawColumns] = addMatch;
    const columns = splitTopLevelComma(rawColumns).map(item => normalizeIdentifier(item));
    const constraint: ParsedConstraint = kind.toLowerCase().includes('primary')
      ? { type: 'PRIMARY_KEY', name: normalizeIdentifier(rawName), columns }
      : { type: 'UNIQUE', name: normalizeIdentifier(rawName), columns };
    return {
      kind: 'ADD_CONSTRAINT',
      table: prefix.table,
      constraint
    };
  }

  const dropMatch = prefix.rest.match(/^drop\s+constraint\s+(?:if\s+exists\s+)?([^\s]+)(?:\s+cascade)?$/i);
  if (dropMatch) {
    return {
      kind: 'DROP_CONSTRAINT',
      table: prefix.table,
      name: normalizeIdentifier(dropMatch[1])
    };
  }

  return null;
}

export function parseDropColumn(stmt: string): SqlOp | null {
  const prefix = parseAlterTablePrefix(stmt);
  if (!prefix) {
    return null;
  }

  const match = prefix.rest.match(/^drop\s+column\s+(?:if\s+exists\s+)?([^\s]+)(?:\s+cascade)?$/i);
  if (!match) {
    return null;
  }

  return {
    kind: 'DROP_COLUMN',
    table: prefix.table,
    column: normalizeIdentifier(match[1])
  };
}

export function parseDropTable(stmt: string): SqlOp | null {
  const match = stmt.match(/^drop\s+table\s+(?:if\s+exists\s+)?([^\s]+)(?:\s+cascade)?$/i);
  if (!match) {
    return null;
  }

  return {
    kind: 'DROP_TABLE',
    table: normalizeIdentifier(match[1])
  };
}

const PARSERS: Array<(stmt: string) => SqlOp | null> = [
  parseCreateTable,
  parseAlterTableAddColumn,
  parseAlterColumnType,
  parseSetDropNotNull,
  parseSetDropDefault,
  parseAddDropConstraint,
  parseDropColumn,
  parseDropTable
];

export function parseMigrationSql(sql: string): ParseResult {
  const statements = splitSqlStatements(sql);
  const ops: SqlOp[] = [];
  const warnings: ParseWarning[] = [];

  for (const raw of statements) {
    const stmt = removeSqlComments(raw).trim();
    if (!stmt) {
      continue;
    }

    let parsed: SqlOp | null = null;
    for (const parseFn of PARSERS) {
      parsed = parseFn(stmt);
      if (parsed) {
        break;
      }
    }

    if (parsed) {
      ops.push(parsed);
    } else {
      warnings.push({
        statement: stmt,
        reason: 'Unsupported or unrecognized statement'
      });
    }
  }

  return { ops, warnings };
}
