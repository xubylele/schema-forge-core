/**
 * Normalize identifiers for deterministic generated names.
 */
export function normalizeIdent(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function pkName(table: string): string {
  return `pk_${normalizeIdent(table)}`;
}

export function uqName(table: string, column: string): string {
  return `uq_${normalizeIdent(table)}_${normalizeIdent(column)}`;
}

export function legacyPkName(table: string): string {
  return `${normalizeIdent(table)}_pkey`;
}

export function legacyUqName(table: string, column: string): string {
  return `${normalizeIdent(table)}_${normalizeIdent(column)}_key`;
}

function normalizeSpacesOutsideQuotes(value: string): string {
  let result = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let pendingSpace = false;

  for (const char of value) {
    if (char === "'" && !inDoubleQuote) {
      if (pendingSpace && result.length > 0 && result[result.length - 1] !== ' ') {
        result += ' ';
      }
      pendingSpace = false;
      inSingleQuote = !inSingleQuote;
      result += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      if (pendingSpace && result.length > 0 && result[result.length - 1] !== ' ') {
        result += ' ';
      }
      pendingSpace = false;
      inDoubleQuote = !inDoubleQuote;
      result += char;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && /\s/.test(char)) {
      pendingSpace = true;
      continue;
    }

    if (pendingSpace && result.length > 0 && result[result.length - 1] !== ' ') {
      result += ' ';
    }
    pendingSpace = false;
    result += char;
  }

  return result.trim();
}

function normalizeKnownFunctionsOutsideQuotes(value: string): string {
  let result = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let buffer = '';

  function flushBuffer(): void {
    if (!buffer) {
      return;
    }

    result += buffer
      .replace(/\bnow\s*\(\s*\)/gi, 'now()')
      .replace(/\bgen_random_uuid\s*\(\s*\)/gi, 'gen_random_uuid()');

    buffer = '';
  }

  for (const char of value) {
    if (char === "'" && !inDoubleQuote) {
      flushBuffer();
      inSingleQuote = !inSingleQuote;
      result += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      flushBuffer();
      inDoubleQuote = !inDoubleQuote;
      result += char;
      continue;
    }

    if (inSingleQuote || inDoubleQuote) {
      result += char;
      continue;
    }

    buffer += char;
  }

  flushBuffer();

  return result;
}

function normalizePunctuationOutsideQuotes(value: string): string {
  let result = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < value.length; index++) {
    const char = value[index];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      result += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      result += char;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && (char === '(' || char === ')')) {
      while (result.endsWith(' ')) {
        result = result.slice(0, -1);
      }

      result += char;

      let lookahead = index + 1;
      while (lookahead < value.length && value[lookahead] === ' ') {
        lookahead++;
      }
      index = lookahead - 1;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === ',') {
      while (result.endsWith(' ')) {
        result = result.slice(0, -1);
      }

      result += ', ';

      let lookahead = index + 1;
      while (lookahead < value.length && value[lookahead] === ' ') {
        lookahead++;
      }
      index = lookahead - 1;
      continue;
    }

    result += char;
  }

  return result;
}

export function normalizeDefault(expr: string | null | undefined): string | null {
  if (expr === undefined || expr === null) {
    return null;
  }

  const trimmed = expr.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const normalizedSpacing = normalizeSpacesOutsideQuotes(trimmed);
  const normalizedPunctuation = normalizePunctuationOutsideQuotes(normalizedSpacing);
  return normalizeKnownFunctionsOutsideQuotes(normalizedPunctuation);
}
