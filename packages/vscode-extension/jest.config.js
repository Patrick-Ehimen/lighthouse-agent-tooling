module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/__tests__/**"],
  moduleNameMapper: {
    "^@lighthouse-tooling/(.*)$": "<rootDir>/../$1/src",
    "^vscode$": "<rootDir>/src/__mocks__/vscode.ts",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};
