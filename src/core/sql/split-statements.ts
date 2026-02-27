/**
 * Split SQL text into statements by semicolon.
 *
 * Handles semicolons inside:
 * - single-quoted strings
 * - double-quoted identifiers
 * - line/block comments
 * - dollar-quoted blocks
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag: string | null = null;

  let index = 0;
  while (index < sql.length) {
    const char = sql[index];
    const next = index + 1 < sql.length ? sql[index + 1] : '';

    if (inLineComment) {
      current += char;
      if (char === '\n') {
        inLineComment = false;
      }
      index++;
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === '*' && next === '/') {
        current += next;
        inBlockComment = false;
        index += 2;
        continue;
      }
      index++;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && dollarTag === null) {
      if (char === '-' && next === '-') {
        current += char + next;
        inLineComment = true;
        index += 2;
        continue;
      }

      if (char === '/' && next === '*') {
        current += char + next;
        inBlockComment = true;
        index += 2;
        continue;
      }
    }

    if (!inDoubleQuote && dollarTag === null && char === "'") {
      current += char;
      if (inSingleQuote && next === "'") {
        current += next;
        index += 2;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      index++;
      continue;
    }

    if (!inSingleQuote && dollarTag === null && char === '"') {
      current += char;
      if (inDoubleQuote && next === '"') {
        current += next;
        index += 2;
        continue;
      }
      inDoubleQuote = !inDoubleQuote;
      index++;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (dollarTag === null && char === '$') {
        const remainder = sql.slice(index);
        const match = remainder.match(/^\$[a-zA-Z_][a-zA-Z0-9_]*\$|^\$\$/);
        if (match) {
          dollarTag = match[0];
          current += match[0];
          index += match[0].length;
          continue;
        }
      }

      if (dollarTag !== null && sql.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length;
        dollarTag = null;
        continue;
      }
    }

    if (!inSingleQuote && !inDoubleQuote && dollarTag === null && char === ';') {
      if (current.trim().length > 0) {
        statements.push(current.trim());
      }
      current = '';
      index++;
      continue;
    }

    current += char;
    index++;
  }

  if (current.trim().length > 0) {
    statements.push(current.trim());
  }

  return statements;
}
