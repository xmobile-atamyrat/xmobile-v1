import * as fs from 'fs/promises';
import * as path from 'path';

const LOGS_DIRECTORY = '/home/ubuntu/scripts';
const MAX_FILE_SIZE = 1024 * 1024; // 1MB in bytes

/**
 * Validates that a filename is safe and only contains .log extension
 */
export function validateLogFilename(filename: string): boolean {
  // Only allow alphanumeric, dots, hyphens, underscores, and .log extension
  const validPattern = /^[a-zA-Z0-9._-]+\.log$/;
  return validPattern.test(filename);
}

/**
 * Resolves the full path to a log file and ensures it's within the logs directory
 */
export function resolveLogPath(filename: string): string {
  if (!validateLogFilename(filename)) {
    throw new Error('Invalid log filename');
  }

  const resolvedPath = path.resolve(LOGS_DIRECTORY, filename);
  const logsDir = path.resolve(LOGS_DIRECTORY);

  // Ensure the resolved path is within the logs directory (prevent path traversal)
  if (!resolvedPath.startsWith(logsDir)) {
    throw new Error('Path traversal detected');
  }

  return resolvedPath;
}

/**
 * Gets file size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    throw new Error(`Failed to get file size: ${error}`);
  }
}

/**
 * Lists all .log files in the logs directory
 */
export async function listLogFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(LOGS_DIRECTORY);
    return files.filter((file) => file.endsWith('.log'));
  } catch (error) {
    throw new Error(`Failed to read logs directory: ${error}`);
  }
}

/**
 * Reads a log file if it's within the size limit
 */
export async function readLogFile(filename: string): Promise<string> {
  const filePath = resolveLogPath(filename);

  // Check if file exists
  try {
    await fs.access(filePath);
  } catch (error) {
    throw new Error('Log file not found');
  }

  // Check file size
  const fileSize = await getFileSize(filePath);
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(
      `Log file is too large (${(fileSize / 1024 / 1024).toFixed(2)}MB). Maximum allowed size is 1MB.`,
    );
  }

  // Read file content
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    throw new Error(`Failed to read log file: ${error}`);
  }
}
