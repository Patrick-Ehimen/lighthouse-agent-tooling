import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    // Run tests sequentially to avoid file system race conditions
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types.ts',
        '**/test-helpers.ts',
        '**/setup.ts',
        'src/index.ts', // CLI entry point - tested manually
        '**/*.js', // Exclude any JS files (like demo-test.js)
      ],
      thresholds: {
        lines: 85,
        functions: 90,
        branches: 85,
        statements: 85,
        // Note: Targets set to realistic levels given server.ts has
        // startup/shutdown code that's tested manually but hard to unit test
      },
    },
  },
});

