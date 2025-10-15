/**
 * Test helpers and utilities
 */

import * as fs from "fs/promises";
import * as path from "path";

// Track created directories for proper cleanup
const createdDirs = new Set<string>();

/**
 * Create a temporary test file with unique directory per test
 */
export async function createTestFile(
  filename: string,
  content: string = "test content",
): Promise<string> {
  // Use unique temp directory per test execution to avoid race conditions
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const tempDir = path.join(process.cwd(), "test-temp", uniqueId);
  await fs.mkdir(tempDir, { recursive: true });

  // Track this directory for cleanup
  createdDirs.add(tempDir);

  const filePath = path.join(tempDir, filename);
  await fs.writeFile(filePath, content);

  return filePath;
}

/**
 * Clean up all temporary test files at once
 */
export async function cleanupTestFiles(): Promise<void> {
  const tempDir = path.join(process.cwd(), "test-temp");
  try {
    // Clean up at the end, not during tests
    await fs.rm(tempDir, { recursive: true, force: true });
    createdDirs.clear();
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Wait for a specified amount of time
 */
export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create mock logger
 */
export function createMockLogger() {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    time: <T>(operation: string, fn: () => T | Promise<T>) => fn(),
  };
}
