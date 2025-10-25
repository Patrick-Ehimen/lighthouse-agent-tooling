/**
 * Mock Types
 * @fileoverview Temporary type definitions until extension-core is available
 */

export interface CommandRegistry {
  registerCommand(definition: CommandDefinition): void;
  unregisterCommand(commandId: string): void;
  executeCommand(commandId: string, ...args: unknown[]): Promise<unknown>;
  getCommands(): CommandDefinition[];
  hasCommand(commandId: string): boolean;
}

export interface CommandDefinition {
  id: string;
  title: string;
  description?: string;
  category?: string;
  handler: CommandHandler;
  parameters?: CommandParameter[];
  enabled?: boolean;
  icon?: string;
  keybinding?: string;
}

export type CommandHandler = (...args: unknown[]) => Promise<unknown>;

export interface CommandParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  validator?: (value: unknown) => boolean;
}

export interface ProgressStreamer {
  startProgress(operationId: string, title: string): ProgressStream;
  getProgress(operationId: string): ProgressStream | undefined;
  stopProgress(operationId: string): void;
  getActiveStreams(): ProgressStream[];
}

export interface ProgressStream {
  operationId: string;
  title: string;
  update(progress: ProgressUpdate): void;
  complete(result?: unknown): void;
  fail(error: Error): void;
  cancel(): void;
  getCurrentProgress(): ProgressUpdate;
  isActive(): boolean;
}

export interface ProgressUpdate {
  operationId?: string;
  title?: string;
  progress?: number;
  message?: string;
  completed?: boolean;
  cancelled?: boolean;
  error?: string;
  result?: unknown;
  timestamp?: Date;
}

export interface WorkspaceContextProvider {
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;
  getContext(): Promise<WorkspaceContext>;
  refreshContext(): Promise<WorkspaceContext>;
  watchWorkspace(callback: WorkspaceChangeCallback): WorkspaceWatcher;
  getWorkspaceFiles(): Promise<any[]>;
  getLighthouseFiles(): Promise<any[]>;
  getActiveDatasets(): Promise<any[]>;
}

export interface WorkspaceContext {
  workspacePath: string;
  workspaceName: string;
  activeFile: string | null;
  openFiles: string[];
  projectFiles: any[];
  datasets: any[];
  gitInfo: any;
  metadata: Record<string, any>;
}

export type WorkspaceChangeCallback = (context: WorkspaceContext) => void;

export interface WorkspaceWatcher {
  dispose(): void;
}
