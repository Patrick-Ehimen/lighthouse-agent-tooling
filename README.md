# lighthouse-agent-tooling

Lighthouse Agent Tooling – A set of connectors, IDE extensions, and AI-native developer tools to seamlessly integrate Lighthouse into AI-powered workflows. Supports MCP (Model Context Protocol) connectors, Cursor/IDE extensions for pinning and encrypting datasets/models.

## Code Style

This repo uses ESLint (flat config) and Prettier for consistent code quality and formatting.

- Run lint: `pnpm lint`
- Auto-fix: `pnpm lint:fix`
- Format: `pnpm format`

Pre-commit hooks via Husky run lint-staged to format and lint changed files.
