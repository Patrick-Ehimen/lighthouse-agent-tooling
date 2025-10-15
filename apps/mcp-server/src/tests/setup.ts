/**
 * Global test setup and teardown
 */

import { afterAll } from "vitest";
import { cleanupTestFiles } from "./utils/test-helpers.js";

// Clean up all test files after all tests complete
afterAll(async () => {
  await cleanupTestFiles();
});
