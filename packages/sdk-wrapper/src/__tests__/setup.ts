/**
 * Jest test setup file
 */

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to ignore specific console methods during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Global test timeout
jest.setTimeout(10000);

// Basic test to ensure setup works
describe("Test Setup", () => {
  it("should be configured correctly", () => {
    expect(true).toBe(true);
  });
});
