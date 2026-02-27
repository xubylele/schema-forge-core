import path from 'path';

/**
 * Get the project root directory
 * For MVP, this is just the current working directory
 */
export function getProjectRoot(cwd: string = process.cwd()): string {
  return cwd;
}

/**
 * Get the SchemaForge directory path
 */
export function getSchemaForgeDir(root: string): string {
  return path.join(root, 'schemaforge');
}

/**
 * Get the schema file path
 * Default: schemaforge/schema.sf
 */
export function getSchemaFilePath(root: string, config?: { schemaFile?: string }): string {
  const schemaForgeDir = getSchemaForgeDir(root);
  const fileName = config?.schemaFile || 'schema.sf';
  return path.join(schemaForgeDir, fileName);
}

/**
 * Get the config file path
 * Default: schemaforge/config.json
 */
export function getConfigPath(root: string): string {
  const schemaForgeDir = getSchemaForgeDir(root);
  return path.join(schemaForgeDir, 'config.json');
}

/**
 * Get the state file path
 * Default: schemaforge/state.json
 */
export function getStatePath(root: string, config?: { stateFile?: string }): string {
  const schemaForgeDir = getSchemaForgeDir(root);
  const fileName = config?.stateFile || 'state.json';
  return path.join(schemaForgeDir, fileName);
}
