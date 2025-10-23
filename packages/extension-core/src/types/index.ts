/**
 * Extension core types and interfaces
 * @fileoverview Type definitions for the extension core module
 */

import type {
  WorkspaceContext as BaseWorkspaceContext,
  AIContext as BaseAIContext,
  ProgressUpdate as BaseProgressUpdate,
} from "@lighthouse-tooling/types";

/**
 * Extension core interface
 */
export interface ExtensionCore {
  /** Initialize the extension core */
  initialize(): Promise<void>;
  /** Dispose of resources */
  dispose(): Promise<void>;
  /** Get the command registry */
  getCommandRegistry(): CommandRegistry;
  /** Get the workspace context provider */
  getWorkspaceContextProvider(): WorkspaceContextProvider;
  /** Get the AI command handler */
  getAICommandHandler(): AICommandHandler;
  /** Get the progress streamer */
  getProgressStreamer(): ProgressStreamer;
  /** Get the configuration manager */
  getConfigurationManager(): ConfigurationManager;
  /** Check if the extension is initialized */
  isInitialized(): boolean;
}

/**
 * Command registry interface
 */
export interface CommandRegistry {
  /** Register a command */
  registerCommand(definition: CommandDefinition): void;
  /** Unregister a command */
  unregisterCommand(commandId: string): void;
  /** Execute a command */
  executeCommand(commandId: string, ...args: unknown[]): Promise<unknown>;
  /** Get all registered commands */
  getCommands(): CommandDefinition[];
  /** Check if a command is registered */
  hasCommand(commandId: string): boolean;
}

/**
 * Command definition
 */
export interface CommandDefinition {
  /** Unique command identifier */
  id: string;
  /** Command title */
  title: string;
  /** Command description */
  description?: string;
  /** Command category */
  category?: string;
  /** Command handler function */
  handler: CommandHandler;
  /** Command parameters */
  parameters?: CommandParameter[];
  /** Whether the command is enabled */
  enabled?: boolean;
  /** Command icon */
  icon?: string;
  /** Keyboard shortcut */
  keybinding?: string;
}

/**
 * Command handler function type
 */
export type CommandHandler = (...args: unknown[]) => Promise<unknown>;

/**
 * Command parameter definition
 */
export interface CommandParameter {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: "string" | "number" | "boolean" | "object" | "array";
  /** Parameter description */
  description?: string;
  /** Whether the parameter is required */
  required?: boolean;
  /** Default value */
  defaultValue?: unknown;
  /** Validation function */
  validator?: (value: unknown) => boolean;
}

/**
 * Progress streamer interface
 */
export interface ProgressStreamer {
  /** Start a progress stream */
  startProgress(operationId: string, title: string): ProgressStream;
  /** Get an existing progress stream */
  getProgress(operationId: string): ProgressStream | undefined;
  /** Stop a progress stream */
  stopProgress(operationId: string): void;
  /** Get all active progress streams */
  getActiveStreams(): ProgressStream[];
}

/**
 * Progress stream interface
 */
export interface ProgressStream {
  /** Operation identifier */
  operationId: string;
  /** Progress title */
  title: string;
  /** Update progress */
  update(progress: ProgressUpdate): void;
  /** Complete the progress */
  complete(result?: unknown): void;
  /** Fail the progress */
  fail(error: Error): void;
  /** Cancel the progress */
  cancel(): void;
  /** Get current progress */
  getCurrentProgress(): ProgressUpdate;
  /** Check if the progress is active */
  isActive(): boolean;
}

/**
 * Workspace context provider interface
 */
export interface WorkspaceContextProvider {
  /** Initialize the workspace context provider */
  initialize?(): Promise<void>;
  /** Dispose of the workspace context provider */
  dispose?(): Promise<void>;
  /** Get the current workspace context */
  getContext(): Promise<BaseWorkspaceContext>;
  /** Refresh the workspace context */
  refreshContext(): Promise<BaseWorkspaceContext>;
  /** Watch for workspace changes */
  watchWorkspace(callback: WorkspaceChangeCallback): WorkspaceWatcher;
  /** Get workspace files */
  getWorkspaceFiles(): Promise<any[]>;
  /** Get Lighthouse files */
  getLighthouseFiles(): Promise<any[]>;
  /** Get active datasets */
  getActiveDatasets(): Promise<any[]>;
}

/**
 * Workspace change callback
 */
export type WorkspaceChangeCallback = (context: BaseWorkspaceContext) => void;

/**
 * Workspace watcher interface
 */
export interface WorkspaceWatcher {
  /** Stop watching */
  dispose(): void;
}

/**
 * AI command handler interface
 */
export interface AICommandHandler {
  /** Initialize the AI command handler */
  initialize?(): Promise<void>;
  /** Dispose of the AI command handler */
  dispose?(): Promise<void>;
  /** Handle an AI command */
  handleCommand(command: AICommand): Promise<AICommandResult>;
  /** Register an AI command handler */
  registerHandler(commandType: string, handler: AICommandHandlerFunction): void;
  /** Unregister an AI command handler */
  unregisterHandler(commandType: string): void;
  /** Get available AI commands */
  getAvailableCommands(): AICommandDefinition[];
}

/**
 * AI command
 */
export interface AICommand {
  /** Command type */
  type: string;
  /** Command parameters */
  parameters: Record<string, unknown>;
  /** AI context */
  context: BaseAIContext;
  /** Request metadata */
  metadata?: Record<string, unknown>;
}

/**
 * AI command result
 */
export interface AICommandResult {
  /** Whether the command succeeded */
  success: boolean;
  /** Result data */
  data?: unknown;
  /** Error information */
  error?: string;
  /** Execution metadata */
  metadata?: Record<string, unknown>;
}

/**
 * AI command handler function
 */
export type AICommandHandlerFunction = (command: AICommand) => Promise<AICommandResult>;

/**
 * AI command definition
 */
export interface AICommandDefinition {
  /** Command type */
  type: string;
  /** Command name */
  name: string;
  /** Command description */
  description: string;
  /** Command parameters */
  parameters: AICommandParameter[];
  /** Command examples */
  examples?: AICommandExample[];
}

/**
 * AI command parameter
 */
export interface AICommandParameter {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: string;
  /** Parameter description */
  description: string;
  /** Whether the parameter is required */
  required: boolean;
  /** Parameter schema */
  schema?: Record<string, unknown>;
}

/**
 * AI command example
 */
export interface AICommandExample {
  /** Example description */
  description: string;
  /** Example parameters */
  parameters: Record<string, unknown>;
  /** Expected result */
  expectedResult?: unknown;
}

/**
 * Configuration manager interface
 */
export interface ConfigurationManager {
  /** Initialize the configuration manager */
  initialize?(): Promise<void>;
  /** Dispose of the configuration manager */
  dispose?(): Promise<void>;
  /** Get configuration */
  getConfiguration(): ExtensionConfiguration;
  /** Update configuration */
  updateConfiguration(config: Partial<ExtensionConfiguration>): Promise<void>;
  /** Watch for configuration changes */
  watchConfiguration(callback: ConfigurationChangeCallback): ConfigurationWatcher;
  /** Reset configuration to defaults */
  resetConfiguration(): Promise<void>;
}

/**
 * Configuration change callback
 */
export type ConfigurationChangeCallback = (config: ExtensionConfiguration) => void;

/**
 * Configuration watcher interface
 */
export interface ConfigurationWatcher {
  /** Stop watching */
  dispose(): void;
}

/**
 * Extension configuration
 */
export interface ExtensionConfiguration {
  /** Lighthouse API configuration */
  lighthouse: LighthouseConfiguration;
  /** AI integration configuration */
  ai: AIConfiguration;
  /** Workspace configuration */
  workspace: WorkspaceConfiguration;
  /** UI configuration */
  ui: UIConfiguration;
  /** Performance configuration */
  performance: PerformanceConfiguration;
}

/**
 * Lighthouse configuration
 */
export interface LighthouseConfiguration {
  /** API endpoint */
  apiEndpoint: string;
  /** API key */
  apiKey?: string;
  /** Default encryption settings */
  encryption: EncryptionConfiguration;
  /** Upload settings */
  upload: UploadConfiguration;
  /** Download settings */
  download: DownloadConfiguration;
}

/**
 * Encryption configuration
 */
export interface EncryptionConfiguration {
  /** Whether to encrypt by default */
  enabled: boolean;
  /** Encryption algorithm */
  algorithm: string;
  /** Key management settings */
  keyManagement: KeyManagementConfiguration;
}

/**
 * Key management configuration
 */
export interface KeyManagementConfiguration {
  /** Key storage method */
  storageMethod: string;
  /** Key rotation settings */
  rotation: KeyRotationConfiguration;
}

/**
 * Key rotation configuration
 */
export interface KeyRotationConfiguration {
  /** Whether key rotation is enabled */
  enabled: boolean;
  /** Rotation interval in days */
  intervalDays: number;
}

/**
 * Upload configuration
 */
export interface UploadConfiguration {
  /** Maximum file size in bytes */
  maxFileSize: number;
  /** Chunk size for uploads */
  chunkSize: number;
  /** Maximum concurrent uploads */
  maxConcurrentUploads: number;
  /** Upload timeout in milliseconds */
  timeout: number;
}

/**
 * Download configuration
 */
export interface DownloadConfiguration {
  /** Download directory */
  directory: string;
  /** Maximum concurrent downloads */
  maxConcurrentDownloads: number;
  /** Download timeout in milliseconds */
  timeout: number;
}

/**
 * AI configuration
 */
export interface AIConfiguration {
  /** Enabled AI agents */
  enabledAgents: string[];
  /** AI preferences */
  preferences: AIPreferences;
  /** Command timeout in milliseconds */
  commandTimeout: number;
}

/**
 * AI preferences
 */
export interface AIPreferences {
  /** Auto-sync settings */
  autoSync: boolean;
  /** Preferred file types */
  preferredFileTypes: string[];
  /** Notification settings */
  notifications: NotificationPreferences;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  /** Show progress notifications */
  showProgress: boolean;
  /** Show completion notifications */
  showCompletion: boolean;
  /** Show error notifications */
  showErrors: boolean;
}

/**
 * Workspace configuration
 */
export interface WorkspaceConfiguration {
  /** Auto-discovery settings */
  autoDiscovery: AutoDiscoveryConfiguration;
  /** File watching settings */
  fileWatching: FileWatchingConfiguration;
  /** Git integration settings */
  gitIntegration: GitIntegrationConfiguration;
}

/**
 * Auto-discovery configuration
 */
export interface AutoDiscoveryConfiguration {
  /** Whether auto-discovery is enabled */
  enabled: boolean;
  /** File patterns to include */
  includePatterns: string[];
  /** File patterns to exclude */
  excludePatterns: string[];
}

/**
 * File watching configuration
 */
export interface FileWatchingConfiguration {
  /** Whether file watching is enabled */
  enabled: boolean;
  /** Debounce delay in milliseconds */
  debounceDelay: number;
  /** File patterns to watch */
  watchPatterns: string[];
}

/**
 * Git integration configuration
 */
export interface GitIntegrationConfiguration {
  /** Whether Git integration is enabled */
  enabled: boolean;
  /** Whether to track Git changes */
  trackChanges: boolean;
  /** Whether to include commit information */
  includeCommitInfo: boolean;
}

/**
 * UI configuration
 */
export interface UIConfiguration {
  /** Theme settings */
  theme: ThemeConfiguration;
  /** Layout settings */
  layout: LayoutConfiguration;
  /** Animation settings */
  animations: AnimationConfiguration;
}

/**
 * Theme configuration
 */
export interface ThemeConfiguration {
  /** Color scheme */
  colorScheme: "light" | "dark" | "auto";
  /** Accent color */
  accentColor: string;
}

/**
 * Layout configuration
 */
export interface LayoutConfiguration {
  /** Panel position */
  panelPosition: "left" | "right" | "bottom";
  /** Panel width */
  panelWidth: number;
  /** Show status bar */
  showStatusBar: boolean;
}

/**
 * Animation configuration
 */
export interface AnimationConfiguration {
  /** Whether animations are enabled */
  enabled: boolean;
  /** Animation duration in milliseconds */
  duration: number;
}

/**
 * Performance configuration
 */
export interface PerformanceConfiguration {
  /** Cache settings */
  cache: CacheConfiguration;
  /** Memory settings */
  memory: MemoryConfiguration;
  /** Network settings */
  network: NetworkConfiguration;
}

/**
 * Cache configuration
 */
export interface CacheConfiguration {
  /** Whether caching is enabled */
  enabled: boolean;
  /** Cache size limit in MB */
  sizeLimit: number;
  /** Cache TTL in milliseconds */
  ttl: number;
}

/**
 * Memory configuration
 */
export interface MemoryConfiguration {
  /** Memory limit in MB */
  limit: number;
  /** Garbage collection settings */
  gc: GCConfiguration;
}

/**
 * Garbage collection configuration
 */
export interface GCConfiguration {
  /** Whether aggressive GC is enabled */
  aggressive: boolean;
  /** GC interval in milliseconds */
  interval: number;
}

/**
 * Network configuration
 */
export interface NetworkConfiguration {
  /** Request timeout in milliseconds */
  timeout: number;
  /** Maximum retries */
  maxRetries: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
}

/**
 * Extension event types
 */
export interface ExtensionEvent {
  /** Event type */
  type: string;
  /** Event data */
  data: unknown;
  /** Event timestamp */
  timestamp: Date;
  /** Event source */
  source: string;
}

// Re-define ProgressUpdate for extension use
export interface ProgressUpdate {
  /** Operation identifier */
  operationId?: string;
  /** Progress title */
  title?: string;
  /** Current progress as a percentage (0-100) */
  progress?: number;
  /** Current status message */
  message?: string;
  /** Whether the operation is completed */
  completed?: boolean;
  /** Whether the operation was cancelled */
  cancelled?: boolean;
  /** Error message if failed */
  error?: string;
  /** Result data */
  result?: unknown;
  /** Timestamp of the progress update */
  timestamp?: Date;
}

// Re-export types from the main types package
export type {
  WorkspaceContext as BaseWorkspaceContext,
  AIContext as BaseAIContext,
  ProgressUpdate as BaseProgressUpdate,
  ProjectFile,
  DatasetReference,
} from "@lighthouse-tooling/types";

// Type aliases for convenience
export type WorkspaceContext = BaseWorkspaceContext;
export type AIContext = BaseAIContext;
