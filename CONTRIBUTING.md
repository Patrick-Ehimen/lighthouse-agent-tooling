# Contributing to Our Project

First off, thank you for considering contributing to our project! We appreciate your time and effort. This document provides a set of guidelines for contributing to this project.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v18 or later)
- [pnpm](https://pnpm.io/)

### Installation

1.  Fork the repository and clone it to your local machine.
2.  Install the dependencies using pnpm:

    ```bash
    pnpm install
    ```

### Running the Project

To start the development server, run the following command:

```bash
pnpm dev
```

## Project Structure

This project is a monorepo managed by pnpm workspaces. The project is organized as follows:

-   `apps/`: Contains the applications, such as the documentation and the main server.
-   `packages/`: Contains the shared packages and libraries used by the applications.
-   `tools/`: Contains the tooling and configuration for the project, such as ESLint and TypeScript configurations.

## Commit Message Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for our commit messages. This allows for automated changelog generation and helps keep the commit history clean and easy to understand.

Each commit message consists of a **header**, a **body**, and a **footer**. The header has a special format that includes a **type**, a **scope**, and a **subject**:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The **type** must be one of the following:

-   `feat`: A new feature
-   `fix`: A bug fix
-   `docs`: Documentation only changes
-   `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
-   `refactor`: A code change that neither fixes a bug nor adds a feature
-   `perf`: A code change that improves performance
-   `test`: Adding missing tests or correcting existing tests
-   `chore`: Changes to the build process or auxiliary tools and libraries such as documentation generation

## Code Style

We use [ESLint](https://eslint.org/) for linting and formatting our code. The configuration can be found in the `tools/eslint-config` directory. Before submitting a pull request, please ensure that your code adheres to our style guidelines by running the following command:

```bash
pnpm lint
```

## Submitting a Pull Request

1.  Create a new branch for your feature or bug fix.
2.  Make your changes and commit them using the commit message conventions described above.
3.  Push your changes to your forked repository.
4.  Create a pull request to the `main` branch of the original repository.
5.  In the pull request description, please provide a clear and concise description of the changes you have made.

Thank you for your contribution!
