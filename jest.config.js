/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/packages/shared", "<rootDir>/apps"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  collectCoverageFrom: [
    "packages/shared/src/**/*.ts",
    "apps/*/src/**/*.ts",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/dist/**",
    "!**/build/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json-summary"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapping: {
    "^@lighthouse-tooling/(.*)$": "<rootDir>/packages/$1/src",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testTimeout: 10000,
  verbose: true,
  // CI-friendly configuration
  ci: process.env.CI === "true",
  maxWorkers: process.env.CI ? 2 : "50%",
  // Transform configuration for TypeScript
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
  // Module file extensions
  moduleFileExtensions: ["ts", "js", "json"],
  // Ignore patterns
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/build/"],
};
