module.exports = {
  parser: '@typescript-eslint/parser',
  env: {
    node: true,
    es6: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    // Basic rules for placeholder files
    'no-unused-vars': 'warn',
    'no-console': 'off',
  },
  ignorePatterns: ['dist/**', 'node_modules/**'],
};
