/**
 * Safety middleware layer for destructive operation validation and classification.
 * Centralizes all destructive operation handling with a standardized interface.
 */

import type { Operation } from '../../types/schema.js';

/**
 * Safety level for an operation.
 * - SAFE: Non-destructive, no data loss possible
 * - WARNING: Potentially destructive, might cause data loss under certain conditions
 * - DESTRUCTIVE: Explicitly removes data or structure
 */
export type SafetyLevel = 'SAFE' | 'WARNING' | 'DESTRUCTIVE';

/**
 * Operation code for destructive changes.
 */
export type DestructiveOperationCode =
  | 'DROP_TABLE'
  | 'DROP_COLUMN'
  | 'ALTER_COLUMN_TYPE'
  | 'SET_NOT_NULL'
  | 'DROP_POLICY'
  | 'MODIFY_POLICY';

/**
 * Finding represents a detected issue or classification of an operation.
 * Extends the original Finding type with safetyLevel and operationKind for middleware context.
 */
export interface Finding {
  safetyLevel: SafetyLevel;
  code: DestructiveOperationCode;
  table: string;
  column?: string;
  from?: string;
  to?: string;
  message: string;
  operationKind: Operation['kind'];
}

/**
 * Safety report aggregates findings by safety level.
 */
export interface SafetyReport {
  findings: Finding[];
  hasSafeIssues: boolean;
  hasWarnings: boolean;
  hasDestructiveOps: boolean;
}

export { classifyOperation } from './operation-classifier.js';
export { checkOperationSafety, checkSchemaSafety } from './safety-checker.js';
