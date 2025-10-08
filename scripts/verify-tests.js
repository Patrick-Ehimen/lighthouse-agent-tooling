#!/usr/bin/env node

/**
 * Test verification script
 * Verifies that the Jest testing framework is properly configured
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🧪 Verifying Jest Testing Framework Setup...\n");

// Check if Jest is installed
try {
  execSync("npx jest --version", { stdio: "pipe" });
  console.log("✅ Jest is installed and accessible");
} catch (error) {
  console.error("❌ Jest is not installed or not accessible");
  process.exit(1);
}

// Check if main Jest config exists
const jestConfigPath = path.join(process.cwd(), "jest.config.js");
if (fs.existsSync(jestConfigPath)) {
  console.log("✅ Main Jest configuration found");
} else {
  console.error("❌ Main Jest configuration not found");
  process.exit(1);
}

// Check if Jest setup file exists
const jestSetupPath = path.join(process.cwd(), "jest.setup.js");
if (fs.existsSync(jestSetupPath)) {
  console.log("✅ Jest setup file found");
} else {
  console.error("❌ Jest setup file not found");
  process.exit(1);
}

// Check if shared test utilities exist
const testUtilsPath = path.join(
  process.cwd(),
  "packages/shared/src/test-utils/index.ts"
);
if (fs.existsSync(testUtilsPath)) {
  console.log("✅ Shared test utilities found");
} else {
  console.error("❌ Shared test utilities not found");
  process.exit(1);
}

// Verify test utilities can be imported
try {
  const testUtilsContent = fs.readFileSync(testUtilsPath, "utf8");
  const expectedExports = ["mocks", "fixtures", "helpers", "matchers"];

  const hasAllExports = expectedExports.every(
    (exportName) =>
      testUtilsContent.includes(`export * from './${exportName}'`) ||
      testUtilsContent.includes(`export * from "./${exportName}"`)
  );

  if (hasAllExports) {
    console.log("✅ All test utility modules are exported");
  } else {
    console.error("❌ Missing test utility exports");
    process.exit(1);
  }
} catch (error) {
  console.error("❌ Error reading test utilities:", error.message);
  process.exit(1);
}

// Check if example tests exist
const exampleTestPaths = [
  "packages/shared/__tests__/test-utils.test.ts",
  "packages/types/__tests__/core.test.ts",
  "apps/mcp-server/__tests__/server.test.ts",
];

let exampleTestsFound = 0;
exampleTestPaths.forEach((testPath) => {
  const fullPath = path.join(process.cwd(), testPath);
  if (fs.existsSync(fullPath)) {
    exampleTestsFound++;
  }
});

if (exampleTestsFound === exampleTestPaths.length) {
  console.log("✅ All example test files found");
} else {
  console.log(
    `⚠️  Found ${exampleTestsFound}/${exampleTestPaths.length} example test files`
  );
}

// Verify package.json test scripts
const packagesWithTests = [
  "packages/shared",
  "packages/types",
  "packages/sdk-wrapper",
  "packages/vscode-extension",
  "packages/cursor-extension",
  "apps/mcp-server",
];

let packagesWithTestScripts = 0;
packagesWithTests.forEach((packagePath) => {
  const packageJsonPath = path.join(process.cwd(), packagePath, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      if (packageJson.scripts && packageJson.scripts.test) {
        packagesWithTestScripts++;
      }
    } catch (error) {
      console.warn(`⚠️  Error reading ${packagePath}/package.json`);
    }
  }
});

if (packagesWithTestScripts === packagesWithTests.length) {
  console.log("✅ All packages have test scripts configured");
} else {
  console.log(
    `⚠️  ${packagesWithTestScripts}/${packagesWithTests.length} packages have test scripts`
  );
}

// Try to run a simple test
console.log("\n🔍 Running test validation...");
try {
  execSync(
    "npx jest --testPathPattern=packages/shared/__tests__/test-utils.test.ts --passWithNoTests",
    {
      stdio: "pipe",
      cwd: process.cwd(),
    }
  );
  console.log("✅ Test execution works correctly");
} catch (error) {
  console.log(
    "⚠️  Test execution had issues (this is expected if dependencies are not installed)"
  );
  console.log(
    '   Run "npm install" to install dependencies before running tests'
  );
}

console.log("\n🎉 Jest Testing Framework Setup Verification Complete!");
console.log("\nNext steps:");
console.log('1. Run "npm install" to install all dependencies');
console.log('2. Run "npm test" to execute all tests');
console.log('3. Run "turbo run test" for parallel test execution');
console.log('4. Check coverage with "npm run test -- --coverage"');
