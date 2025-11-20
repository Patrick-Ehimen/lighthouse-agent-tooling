/**
 * Lighthouse AI Integration Extension Core
 * @fileoverview Main export file for the shared IDE extension core module
 *
 * This package provides shared business logic, workspace context management,
 * AI command handling, and progress streaming for IDE extensions.
 *
 * @packageDocumentation
 */

// Core extension functionality
export * from "./core/extension-core.js";
export * from "./core/command-registry.js";
export * from "./core/progress-streamer.js";

// Workspace context management
export * from "./workspace/context-provider.js";
export * from "./workspace/file-watcher.js";
export * from "./workspace/git-integration.js";

// AI integration
export * from "./ai/ai-command-handler.js";
export * from "./ai/ai-context-manager.js";
export * from "./ai/ai-session-manager.js";

// Event system
export * from "./events/event-emitter.js";
export * from "./events/event-types.js";

// Configuration management
export * from "./config/configuration-manager.js";
export * from "./config/settings-provider.js";

// Re-export commonly used types and interfaces
export type {
  ExtensionCore,
  CommandRegistry,
  ProgressStreamer,
  WorkspaceContextProvider,
  AICommandHandler,
  ExtensionConfiguration,
  ExtensionEvent,
  CommandDefinition,
  ProgressUpdate,
  AIContext,
  WorkspaceContext,
  AICommand,
  AICommandResult,
  AICommandHandlerFunction,
  AICommandDefinition,
  AICommandParameter,
  AICommandExample,
} from "./types/index.js";
