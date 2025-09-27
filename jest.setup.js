// Global test setup file
// This file is executed before each test file

// Set test timeout
jest.setTimeout(10000);

// Mock console methods in tests to reduce noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Reset console mocks before each test
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  // Restore original console methods after each test
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
global.testUtils = {
  // Helper to create mock promises
  createMockPromise: (resolveValue, delay = 0) => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(resolveValue), delay);
    });
  },

  // Helper to create rejected promises
  createRejectedPromise: (error, delay = 0) => {
    return new Promise((_, reject) => {
      setTimeout(() => reject(error), delay);
    });
  },
};
