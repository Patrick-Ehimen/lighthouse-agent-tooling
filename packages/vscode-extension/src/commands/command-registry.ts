/**
 * VSCode Command Registry
 * @fileoverview VSCode-specific implementation of command registry
 */

import * as vscode from "vscode";
import type { CommandRegistry, CommandDefinition, CommandHandler } from "../types/mock-types";

/**
 * VSCode command registry implementation
 */
export class VSCodeCommandRegistry implements CommandRegistry {
  private commands = new Map<string, CommandDefinition>();

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Register a command
   */
  registerCommand(definition: CommandDefinition): void {
    if (this.commands.has(definition.id)) {
      throw new Error(`Command ${definition.id} is already registered`);
    }

    // Register with VSCode
    const disposable = vscode.commands.registerCommand(definition.id, definition.handler);
    this.context.subscriptions.push(disposable);

    // Store definition
    this.commands.set(definition.id, definition);
  }

  /**
   * Unregister a command
   */
  unregisterCommand(commandId: string): void {
    if (!this.commands.has(commandId)) {
      return;
    }

    this.commands.delete(commandId);
    // Note: VSCode doesn't provide a way to unregister commands
    // They are automatically disposed when the extension deactivates
  }

  /**
   * Execute a command
   */
  async executeCommand(commandId: string, ...args: unknown[]): Promise<unknown> {
    const definition = this.commands.get(commandId);
    if (!definition) {
      throw new Error(`Command ${commandId} is not registered`);
    }

    if (!definition.enabled) {
      throw new Error(`Command ${commandId} is disabled`);
    }

    try {
      return await definition.handler(...args);
    } catch (error) {
      throw new Error(
        `Command ${commandId} failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get all registered commands
   */
  getCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * Check if a command is registered
   */
  hasCommand(commandId: string): boolean {
    return this.commands.has(commandId);
  }
}
