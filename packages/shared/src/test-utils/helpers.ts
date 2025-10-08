/**
 * Test helper functions and utilities
 */

/**
 * Wait for a specified amount of time (useful for async testing)
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Wait for a condition to be true with timeout
 */
export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return;
    }
    await wait(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
};

/**
 * Create a temporary directory for testing
 */
export const createTempDir = (): string => {
  const os = require("os");
  const path = require("path");
  const fs = require("fs");

  const tempDir = path.join(os.tmpdir(), `lighthouse-test-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  return tempDir;
};

/**
 * Clean up temporary directory
 */
export const cleanupTempDir = (dirPath: string): void => {
  const fs = require("fs");

  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Failed to cleanup temp directory: ${dirPath}`, error);
  }
};

/**
 * Create a temporary file with content
 */
export const createTempFile = (
  content: string,
  extension: string = ".txt"
): string => {
  const fs = require("fs");
  const path = require("path");

  const tempDir = createTempDir();
  const filePath = path.join(tempDir, `test-file${extension}`);

  fs.writeFileSync(filePath, content);

  return filePath;
};

/**
 * Mock environment variables for testing
 */
export const mockEnv = (envVars: Record<string, string>) => {
  const originalEnv = { ...process.env };

  // Set mock environment variables
  Object.assign(process.env, envVars);

  // Return cleanup function
  return () => {
    // Restore original environment
    process.env = originalEnv;
  };
};

/**
 * Capture console output for testing
 */
export const captureConsole = () => {
  const logs: string[] = [];
  const errors: string[] = [];
  const warns: string[] = [];

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args: any[]) => {
    logs.push(args.join(" "));
  };

  console.error = (...args: any[]) => {
    errors.push(args.join(" "));
  };

  console.warn = (...args: any[]) => {
    warns.push(args.join(" "));
  };

  return {
    logs,
    errors,
    warns,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    },
  };
};

/**
 * Create a mock function with specific behavior
 */
export const createMockFunction = <T extends (...args: any[]) => any>(
  implementation?: T
): jest.MockedFunction<T> => {
  const mockFn = jest.fn();

  if (implementation) {
    mockFn.mockImplementation(implementation);
  }

  return mockFn as unknown as jest.MockedFunction<T>;
};

/**
 * Create a spy on an object method
 */
export const createSpy = <T extends object, K extends keyof T>(
  object: T,
  method: K
): jest.SpyInstance => {
  return jest.spyOn(object, method as any);
};

/**
 * Assert that a function throws an error with specific message
 */
export const expectToThrow = async (
  fn: () => Promise<any> | any,
  expectedMessage?: string | RegExp
): Promise<Error> => {
  let error: Error | undefined;

  try {
    await fn();
  } catch (e) {
    error = e as Error;
  }

  if (!error) {
    throw new Error("Expected function to throw an error, but it did not");
  }

  if (expectedMessage) {
    if (typeof expectedMessage === "string") {
      expect(error.message).toContain(expectedMessage);
    } else {
      expect(error.message).toMatch(expectedMessage);
    }
  }

  return error;
};

/**
 * Create a promise that resolves after a delay
 */
export const delayedResolve = <T>(
  value: T,
  delay: number = 100
): Promise<T> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), delay);
  });
};

/**
 * Create a promise that rejects after a delay
 */
export const delayedReject = (
  error: Error,
  delay: number = 100
): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(error), delay);
  });
};

/**
 * Generate random test data
 */
export const generateTestData = {
  string: (length: number = 10): string => {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  number: (min: number = 0, max: number = 100): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  boolean: (): boolean => {
    return Math.random() < 0.5;
  },

  array: <T>(generator: () => T, length: number = 5): T[] => {
    return Array.from({ length }, generator);
  },

  cid: (): string => {
    // Base58 alphabet (excludes 0, O, I, l to avoid confusion)
    const base58chars =
      "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let result = "Qm";
    for (let i = 0; i < 44; i++) {
      result += base58chars.charAt(
        Math.floor(Math.random() * base58chars.length)
      );
    }
    return result;
  },
};
