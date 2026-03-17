import type {
  Column,
  ColumnType,
  DatabaseSchema,
  ForeignKey,
  PolicyCommand,
  PolicyNode,
} from '../types/schema.js';

const POLICY_COMMANDS: PolicyCommand[] = ['select', 'insert', 'update', 'delete', 'all'];

/**
 * Parse a schema from DSL source string
 * 
 * Supported DSL:
 * - Comments: lines starting with # or // are ignored
 * - Blocks:
 *   table <name> {
 *     <colName> <type> [modifiers...]
 *   }
 *   policy "<name>" on <table>
 *   for select|insert|update|delete
 *   [using <expression>]
 *   [with check <expression>]
 * 
 * Supported modifiers:
 * - pk (primary key)
 * - unique
 * - not null
 * - nullable
 * - default <value>
 * - fk <table>.<column> (e.g., fk users.id)
 * 
 * @param source - DSL source string
 * @returns DatabaseSchema with tables and columns in order
 * @throws Error if parsing fails
 */
export function parseSchema(source: string): DatabaseSchema {
  const lines = source.split('\n');
  const tables: Record<
    string,
    { name: string; columns: Column[]; primaryKey?: string | null; policies?: PolicyNode[] }
  > = {};
  const policyList: { policy: PolicyNode; startLine: number }[] = [];

  let currentLine = 0;

  const validBaseColumnTypes: Set<string> = new Set([
    'uuid', 'varchar', 'text', 'int', 'bigint', 'boolean', 'timestamptz', 'date'
  ]);
  const validIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

  function normalizeColumnType(type: string): string {
    return type
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\s*\(\s*/g, '(')
      .replace(/\s*,\s*/g, ',')
      .replace(/\s*\)\s*/g, ')');
  }

  function isValidColumnType(type: string): boolean {
    const normalizedType = normalizeColumnType(type);
    if (validBaseColumnTypes.has(normalizedType)) {
      return true;
    }

    const varcharMatch = normalizedType.match(/^varchar\((\d+)\)$/);
    if (varcharMatch) {
      const length = Number(varcharMatch[1]);
      return Number.isInteger(length) && length > 0;
    }

    const numericMatch = normalizedType.match(/^numeric\((\d+),(\d+)\)$/);
    if (numericMatch) {
      const precision = Number(numericMatch[1]);
      const scale = Number(numericMatch[2]);
      return Number.isInteger(precision) && Number.isInteger(scale) && precision > 0 && scale >= 0 && scale <= precision;
    }

    return false;
  }

  function validateIdentifier(identifier: string, lineNum: number, context: 'table' | 'column' | 'foreign key table' | 'foreign key column'): void {
    if (!validIdentifierPattern.test(identifier)) {
      throw new Error(
        `Line ${lineNum}: Invalid ${context} name '${identifier}'. Use letters, numbers, and underscores, and do not start with a number.`
      );
    }
  }

  function validateDefaultValue(value: string, lineNum: number): void {
    let parenBalance = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let index = 0; index < value.length; index++) {
      const char = value[index];

      if (char === "'" && !inDoubleQuote) {
        if (inSingleQuote && value[index + 1] === "'") {
          index++;
          continue;
        }

        inSingleQuote = !inSingleQuote;
        continue;
      }

      if (char === '"' && !inSingleQuote) {
        if (inDoubleQuote && value[index + 1] === '"') {
          index++;
          continue;
        }

        inDoubleQuote = !inDoubleQuote;
        continue;
      }

      if (inSingleQuote || inDoubleQuote) {
        continue;
      }

      if (char === '(') {
        parenBalance++;
        continue;
      }

      if (char === ')') {
        parenBalance--;
        if (parenBalance < 0) {
          throw new Error(
            `Line ${lineNum}: Invalid default value '${value}'. Unmatched parentheses in function call.`
          );
        }
      }
    }

    if (inSingleQuote || inDoubleQuote) {
      throw new Error(
        `Line ${lineNum}: Invalid default value '${value}'. Unterminated quoted string.`
      );
    }

    if (parenBalance > 0) {
      if (parenBalance === 1) {
        throw new Error(
          `Line ${lineNum}: Invalid default value '${value}'. Function call is missing closing parenthesis.`
        );
      }

      throw new Error(
        `Line ${lineNum}: Invalid default value '${value}'. Unmatched parentheses in function call.`
      );
    }
  }

  /**
   * Remove comments and trim whitespace from a line
   */
  function cleanLine(line: string): string {
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === "'" && !inDoubleQuote) {
        if (inSingleQuote && nextChar === "'") {
          index++;
          continue;
        }

        inSingleQuote = !inSingleQuote;
        continue;
      }

      if (char === '"' && !inSingleQuote) {
        if (inDoubleQuote && nextChar === '"') {
          index++;
          continue;
        }

        inDoubleQuote = !inDoubleQuote;
        continue;
      }

      if (inSingleQuote || inDoubleQuote) {
        continue;
      }

      if (char === '#') {
        line = line.substring(0, index);
        break;
      }

      if (char === '/' && nextChar === '/') {
        line = line.substring(0, index);
        break;
      }
    }

    return line.trim();
  }

  /**
   * Parse a foreign key reference (e.g., "users.id")
   */
  function parseForeignKey(fkRef: string, lineNum: number): ForeignKey {
    const parts = fkRef.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(`Line ${lineNum}: Invalid foreign key format '${fkRef}'. Expected format: table.column`);
    }

    validateIdentifier(parts[0], lineNum, 'foreign key table');
    validateIdentifier(parts[1], lineNum, 'foreign key column');

    return {
      table: parts[0],
      column: parts[1]
    };
  }

  /**
   * Parse a column definition line
   */
  function parseColumn(line: string, lineNum: number): Column {
    const tokens = line.split(/\s+/).filter(t => t.length > 0);
    const modifiers = new Set(['pk', 'unique', 'nullable', 'default', 'fk']);
    const appliedModifiers = new Set<string>();

    if (tokens.length < 2) {
      throw new Error(`Line ${lineNum}: Invalid column definition. Expected: <name> <type> [modifiers...]`);
    }

    const colName = tokens[0];
    const colType = normalizeColumnType(tokens[1]);

    validateIdentifier(colName, lineNum, 'column');

    if (!isValidColumnType(colType)) {
      throw new Error(
        `Line ${lineNum}: Invalid column type '${tokens[1]}'. Valid types: ${Array.from(validBaseColumnTypes).join(', ')}, varchar(n), numeric(p,s)`
      );
    }

    const column: Column = {
      name: colName,
      type: colType as ColumnType,
      nullable: true
    };

    let i = 2;
    while (i < tokens.length) {
      const modifier = tokens[i];

      const markModifierApplied = (name: string): void => {
        if (appliedModifiers.has(name)) {
          throw new Error(`Line ${lineNum}: Duplicate modifier '${name}'`);
        }
        appliedModifiers.add(name);
      };

      switch (modifier) {
        case 'pk':
          markModifierApplied('pk');
          column.primaryKey = true;
          i++;
          break;

        case 'unique':
          markModifierApplied('unique');
          column.unique = true;
          i++;
          break;

        case 'nullable':
          if (appliedModifiers.has('not null')) {
            throw new Error(`Line ${lineNum}: Cannot combine 'nullable' with 'not null'`);
          }
          markModifierApplied('nullable');
          column.nullable = true;
          i++;
          break;

        case 'not':
          if (tokens[i + 1] !== 'null') {
            throw new Error(`Line ${lineNum}: Unknown modifier 'not'`);
          }

          if (appliedModifiers.has('nullable')) {
            throw new Error(`Line ${lineNum}: Cannot combine 'not null' with 'nullable'`);
          }
          markModifierApplied('not null');

          column.nullable = false;
          i += 2;
          break;

        case 'default':
          markModifierApplied('default');
          i++;
          if (i >= tokens.length) {
            throw new Error(`Line ${lineNum}: 'default' modifier requires a value`);
          }
          {
            const defaultTokens: string[] = [];

            while (
              i < tokens.length &&
              !modifiers.has(tokens[i]) &&
              !(tokens[i] === 'not' && tokens[i + 1] === 'null')
            ) {
              defaultTokens.push(tokens[i]);
              i++;
            }

            if (defaultTokens.length === 0) {
              throw new Error(`Line ${lineNum}: 'default' modifier requires a value`);
            }

            const defaultValue = defaultTokens.join(' ');
            validateDefaultValue(defaultValue, lineNum);
            column.default = defaultValue;
          }
          break;

        case 'fk':
          markModifierApplied('fk');
          i++;
          if (i >= tokens.length) {
            throw new Error(`Line ${lineNum}: 'fk' modifier requires a table.column reference`);
          }
          column.foreignKey = parseForeignKey(tokens[i], lineNum);
          i++;
          break;

        default:
          throw new Error(`Line ${lineNum}: Unknown modifier '${modifier}'`);
      }
    }

    return column;
  }

  /**
   * Parse a policy block (multi-line).
   * First line: policy "<name>" on <table_ident>
   * Continuation: for <command>, optional using <expr>, optional with check <expr>
   */
  function parsePolicyBlock(startLine: number): { policy: PolicyNode; nextLineIndex: number } {
    const firstLine = cleanLine(lines[startLine]);
    const declMatch = firstLine.match(/^policy\s+"([^"]*)"\s+on\s+(\w+)\s*$/);
    if (!declMatch) {
      throw new Error(
        `Line ${startLine + 1}: Invalid policy declaration. Expected: policy "<name>" on <table>`
      );
    }
    const policyName = declMatch[1];
    const tableIdent = declMatch[2];
    validateIdentifier(tableIdent, startLine + 1, 'table');

    let command: PolicyCommand | undefined;
    let using: string | undefined;
    let withCheck: string | undefined;
    let toRoles: string[] | undefined;
    let lineIdx = startLine + 1;

    while (lineIdx < lines.length) {
      const cleaned = cleanLine(lines[lineIdx]);

      if (!cleaned) {
        lineIdx++;
        continue;
      }

      if (cleaned.startsWith('for ')) {
        const rest = cleaned.slice(4).trim().toLowerCase();
        const parts = rest.split(/\s+/);
        const cmd = parts[0];
        if (!POLICY_COMMANDS.includes(cmd as PolicyCommand)) {
          throw new Error(
            `Line ${lineIdx + 1}: Invalid policy command '${cmd}'. Expected: select, insert, update, delete, or all`
          );
        }
        if (command !== undefined) {
          throw new Error(`Line ${lineIdx + 1}: Duplicate 'for' in policy`);
        }
        command = cmd as PolicyCommand;
        if (parts.length > 1 && parts[1] === 'to' && parts.length > 2) {
          toRoles = parts.slice(2);
        }
        lineIdx++;
        continue;
      }

      if (cleaned.startsWith('to ')) {
        if (toRoles !== undefined) {
          throw new Error(`Line ${lineIdx + 1}: Duplicate 'to' in policy`);
        }
        const roles = cleaned.slice(3).trim().split(/\s+/).filter(Boolean);
        if (roles.length > 0) {
          toRoles = roles;
        }
        lineIdx++;
        continue;
      }

      if (cleaned.startsWith('using ')) {
        if (using !== undefined) {
          throw new Error(`Line ${lineIdx + 1}: Duplicate 'using' in policy`);
        }
        using = cleaned.slice(6).trim();
        lineIdx++;
        continue;
      }

      if (cleaned.startsWith('with check ')) {
        if (withCheck !== undefined) {
          throw new Error(`Line ${lineIdx + 1}: Duplicate 'with check' in policy`);
        }
        withCheck = cleaned.slice(11).trim();
        lineIdx++;
        continue;
      }

      break;
    }

    if (command === undefined) {
      throw new Error(`Line ${startLine + 1}: Policy is missing 'for <command>'`);
    }

    const policy: PolicyNode = {
      name: policyName,
      table: tableIdent,
      command,
      ...(using !== undefined && { using }),
      ...(withCheck !== undefined && { withCheck }),
      ...(toRoles !== undefined && toRoles.length > 0 && { to: toRoles }),
    };
    return { policy, nextLineIndex: lineIdx };
  }

  /**
   * Parse a table block
   */
  function parseTableBlock(startLine: number): number {
    const firstLine = cleanLine(lines[startLine]);
    const match = firstLine.match(/^table\s+(\w+)\s*\{\s*$/);

    if (!match) {
      throw new Error(`Line ${startLine + 1}: Invalid table definition. Expected: table <name> {`);
    }

    const tableName = match[1];

    validateIdentifier(tableName, startLine + 1, 'table');

    if (tables[tableName]) {
      throw new Error(`Line ${startLine + 1}: Duplicate table definition '${tableName}'`);
    }

    const columns: Column[] = [];
    let lineIdx = startLine + 1;
    let foundClosingBrace = false;

    while (lineIdx < lines.length) {
      const cleaned = cleanLine(lines[lineIdx]);

      if (!cleaned) {
        lineIdx++;
        continue;
      }

      if (cleaned === '}') {
        foundClosingBrace = true;
        break;
      }

      try {
        const column = parseColumn(cleaned, lineIdx + 1);
        columns.push(column);
      } catch (error) {
        throw error;
      }

      lineIdx++;
    }

    if (!foundClosingBrace) {
      throw new Error(`Line ${startLine + 1}: Table '${tableName}' block not closed (missing '}')`);
    }

    const primaryKeyColumn = columns.find(column => column.primaryKey)?.name ?? null;

    tables[tableName] = {
      name: tableName,
      columns,
      ...(primaryKeyColumn !== null && { primaryKey: primaryKeyColumn }),
    };

    return lineIdx;
  }

  const policyDeclRegex = /^policy\s+"([^"]*)"\s+on\s+\w+/;
  while (currentLine < lines.length) {
    const cleaned = cleanLine(lines[currentLine]);

    if (!cleaned) {
      currentLine++;
      continue;
    }

    if (cleaned.startsWith('table ')) {
      currentLine = parseTableBlock(currentLine);
      currentLine++;
    } else if (policyDeclRegex.test(cleaned)) {
      const { policy, nextLineIndex } = parsePolicyBlock(currentLine);
      policyList.push({ policy, startLine: currentLine + 1 });
      currentLine = nextLineIndex;
    } else {
      throw new Error(
        `Line ${currentLine + 1}: Unexpected content '${cleaned}'. Expected table or policy definition.`
      );
    }
  }

  for (const { policy, startLine } of policyList) {
    if (!tables[policy.table]) {
      throw new Error(
        `Line ${startLine}: Policy "${policy.name}" references undefined table "${policy.table}"`
      );
    }
    if (!tables[policy.table].policies) {
      tables[policy.table].policies = [];
    }
    tables[policy.table].policies!.push(policy);
  }

  return { tables };
}
