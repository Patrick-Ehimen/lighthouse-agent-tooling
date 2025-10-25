/**
 * Extension event types
 * @fileoverview Defines all event types used in the extension
 */

/**
 * Core extension events
 */
export const CORE_EVENTS = {
  INITIALIZED: "core.initialized",
  DISPOSED: "core.disposed",
  ERROR: "core.error",
} as const;

/**
 * Command events
 */
export const COMMAND_EVENTS = {
  REGISTERED: "command.registered",
  UNREGISTERED: "command.unregistered",
  EXECUTED: "command.executed",
  FAILED: "command.failed",
} as const;

/**
 * Progress events
 */
export const PROGRESS_EVENTS = {
  STARTED: "progress.started",
  UPDATED: "progress.updated",
  COMPLETED: "progress.completed",
  FAILED: "progress.failed",
  CANCELLED: "progress.cancelled",
  STOPPED: "progress.stopped",
  CLEARED: "progress.cleared",
} as const;

/**
 * Workspace events
 */
export const WORKSPACE_EVENTS = {
  CHANGED: "workspace.changed",
  CONTEXT_REFRESHED: "workspace.context.refreshed",
  FILE_CHANGED: "workspace.file.changed",
  DATASET_ADDED: "workspace.dataset.added",
  DATASET_REMOVED: "workspace.dataset.removed",
} as const;

/**
 * AI events
 */
export const AI_EVENTS = {
  COMMAND_STARTED: "ai.command.started",
  COMMAND_COMPLETED: "ai.command.completed",
  COMMAND_FAILED: "ai.command.failed",
  CONTEXT_CHANGED: "ai.context.changed",
  SESSION_STARTED: "ai.session.started",
  SESSION_ENDED: "ai.session.ended",
} as const;

/**
 * Configuration events
 */
export const CONFIGURATION_EVENTS = {
  CHANGED: "configuration.changed",
  RESET: "configuration.reset",
  LOADED: "configuration.loaded",
  SAVED: "configuration.saved",
} as const;

/**
 * All extension events
 */
export const EXTENSION_EVENTS = {
  ...CORE_EVENTS,
  ...COMMAND_EVENTS,
  ...PROGRESS_EVENTS,
  ...WORKSPACE_EVENTS,
  ...AI_EVENTS,
  ...CONFIGURATION_EVENTS,
} as const;

/**
 * Event type union
 */
export type ExtensionEventType = (typeof EXTENSION_EVENTS)[keyof typeof EXTENSION_EVENTS];
