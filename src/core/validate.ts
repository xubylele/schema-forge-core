/**
 * Validation module - backward compatibility layer for safety middleware.
 * Delegates to safety module while maintaining the original API.
 */

import type { DatabaseSchema, StateFile } from '../types/schema.js';
import { checkSchemaSafety } from './safety/index.js';
import type { Finding as SafeFinding, SafetyLevel } from './safety/index.js';

export type Severity = 'error' | 'warning';

/**
 * Legacy Finding type for backward compatibility.
 * Maps from the new SafetyLevel to the old Severity type.
 */
export interface Finding {
  severity: Severity;
  code: 'DROP_TABLE' | 'DROP_COLUMN' | 'ALTER_COLUMN_TYPE' | 'SET_NOT_NULL';
  table: string;
  column?: string;
  from?: string;
  to?: string;
  message: string;
}

export interface ValidationReport {
  hasErrors: boolean;
  hasWarnings: boolean;
  errors: Array<Omit<Finding, 'severity'>>;
  warnings: Array<Omit<Finding, 'severity'>>;
}

/**
 * Adapter: converts SafetyLevel to legacy Severity type.
 * - 'DESTRUCTIVE' → 'error'
 * - 'WARNING' → 'warning'
 * - 'SAFE' → not included in findings
 */
function safetyLevelToSeverity(level: SafetyLevel): Severity {
  if (level === 'DESTRUCTIVE') {
    return 'error';
  }
  return 'warning';
}

/**
 * Adapter: converts new SafeFinding to legacy Finding format.
 */
function adaptSafetyFinding(finding: SafeFinding): Finding {
  return {
    severity: safetyLevelToSeverity(finding.safetyLevel),
    code: finding.code,
    table: finding.table,
    column: finding.column,
    from: finding.from,
    to: finding.to,
    message: finding.message,
  };
}

/**
 * Validate schema changes using the safety middleware layer.
 * Delegates to checkSchemaSafety and adapts the result to the legacy Finding format.
 *
 * @param previousState - The previous state of the schema
 * @param currentSchema - The current schema
 * @returns Array of Findings with legacy Severity field
 */
export function validateSchemaChanges(previousState: StateFile, currentSchema: DatabaseSchema): Finding[] {
  const safetyReport = checkSchemaSafety(previousState, currentSchema);
  return safetyReport.findings.map(adaptSafetyFinding);
}

/**
 * Convert findings to a validation report.
 *
 * @param findings - Array of findings
 * @returns ValidationReport with errors and warnings separated
 */
export function toValidationReport(findings: Finding[]): ValidationReport {
  const errors = findings.filter(finding => finding.severity === 'error');
  const warnings = findings.filter(finding => finding.severity === 'warning');

  return {
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
    errors: errors.map(({ severity, ...finding }) => finding),
    warnings: warnings.map(({ severity, ...finding }) => finding),
  };
}
