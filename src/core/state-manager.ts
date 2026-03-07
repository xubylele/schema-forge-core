import path from 'path';
import type { StateFile } from '../types/schema.js';
import { ensureDir, readJsonFile, writeJsonFile } from './fs.js';
import { schemaToState } from './state-transform.js';

export { schemaToState } from './state-transform.js';

/**
 * Load state from disk
 * Returns fallback { version: 1, tables: {} } if file doesn't exist
 */
export async function loadState(statePath: string): Promise<StateFile> {
  return await readJsonFile<StateFile>(statePath, { version: 1, tables: {} });
}

/**
 * Save state to disk
 * Creates parent directories automatically if they don't exist
 */
export async function saveState(statePath: string, state: StateFile): Promise<void> {
  const dirPath = path.dirname(statePath);
  await ensureDir(dirPath);
  await writeJsonFile(statePath, state);
}
