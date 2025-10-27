/**
 * Command registry implementation
 * @fileoverview Manages command registration and execution for the extension
 */

import type { CommandRegistry, CommandDefinition, CommandHandler } from "../types/index.js";
import type { ExtensionEventEmitter } from "../events/event-emitter.js";
import { Logger } from "@lighthouse-tooling/shared";

/**
 * Command registry implementation
 */
export class CommandRegistryImpl implements CommandRegistry {
  private _commands = new Map<string, CommandDefinition>();
  private _logger: Logger;
  private _eventEmitter: ExtensionEventEmitter;

  constructor(eventEmitter: ExtensionEventEmitter) {
    this._logger = new Logger({ level: "info", component: "CommandRegistry" });
    this._eventEmitter = eventEmitter;
  }

  /**
   * Register a command
   */
  registerCommand(definition: CommandDefinition): void {
    if (this._commands.has(definition.id)) {
      this._logger.warn(`Command ${definition.id} is already registered, overwriting`);
    }

    // Validate command definition
    this._validateCommandDefinition(definition);

    // Wrap the handler to add logging and error handling
    const wrappedHandler = this._wrapCommandHandler(definition.id, definition.handler);
    const wrappedDefinition = { ...definition, handler: wrappedHandler };

    this._commands.set(definition.id, wrappedDefinition);
    this._logger.debug(`Registered command: ${definition.id}`);

    // Emit registration event
    this._eventEmitter.emit("command.registered", {
      type: "command.registered",
      data: { commandId: definition.id, definition },
      timestamp: new Date(),
      source: "CommandRegistry",
    });
  }

  /**
   * Unregister a command
   */
  unregisterCommand(commandId: string): void {
    if (!this._commands.has(commandId)) {
      this._logger.warn(`Command ${commandId} is not registered`);
      return;
    }

    this._commands.delete(commandId);
    this._logger.debug(`Unregistered command: ${commandId}`);

    // Emit unregistration event
    this._eventEmitter.emit("command.unregistered", {
      type: "command.unregistered",
      data: { commandId },
      timestamp: new Date(),
      source: "CommandRegistry",
    });
  }

  /**
   * Execute a command
   */
  async executeCommand(commandId: string, ...args: unknown[]): Promise<unknown> {
    const command = this._commands.get(commandId);
    if (!command) {
      const error = new Error(`Command ${commandId} is not registered`);
      this._logger.error(error.message);
      throw error;
    }

    if (command.enabled === false) {
      const error = new Error(`Command ${commandId} is disabled`);
      this._logger.error(error.message);
      throw error;
    }

    this._logger.debug(`Executing command: ${commandId}`, { args });

    try {
      const startTime = Date.now();
      const result = await command.handler(...args);
      const executionTime = Date.now() - startTime;

      this._logger.debug(`Command ${commandId} executed successfully in ${executionTime}ms`);

      // Emit execution event
      this._eventEmitter.emit("command.executed", {
        type: "command.executed",
        data: {
          commandId,
          args,
          result,
          executionTime,
          success: true,
        },
        timestamp: new Date(),
        source: "CommandRegistry",
      });

      return result;
    } catch (error) {
      this._logger.error(`Command ${commandId} failed:`, error as Error);

      // Emit execution error event
      this._eventEmitter.emit("command.failed", {
        type: "command.failed",
        data: {
          commandId,
          args,
          error: error instanceof Error ? error.message : String(error),
          success: false,
        },
        timestamp: new Date(),
        source: "CommandRegistry",
      });

      throw error;
    }
  }

  /**
   * Get all registered commands
   */
  getCommands(): CommandDefinition[] {
    return Array.from(this._commands.values());
  }

  /**
   * Check if a command is registered
   */
  hasCommand(commandId: string): boolean {
    return this._commands.has(commandId);
  }

  /**
   * Get a specific command definition
   */
  getCommand(commandId: string): CommandDefinition | undefined {
    return this._commands.get(commandId);
  }

  /**
   * Get commands by category
   */
  getCommandsByCategory(category: string): CommandDefinition[] {
    return Array.from(this._commands.values()).filter((command) => command.category === category);
  }

  /**
   * Validate command definition
   */
  private _validateCommandDefinition(definition: CommandDefinition): void {
    if (!definition.id) {
      throw new Error("Command definition must have an id");
    }

    if (!definition.title) {
      throw new Error("Command definition must have a title");
    }

    if (typeof definition.handler !== "function") {
      throw new Error("Command definition must have a handler function");
    }

    // Validate parameters if provided
    if (definition.parameters) {
      for (const param of definition.parameters) {
        if (!param.name) {
          throw new Error("Command parameter must have a name");
        }
        if (!param.type) {
          throw new Error("Command parameter must have a type");
        }
      }
    }
  }

  /**
   * Wrap command handler with logging and error handling
   */
  private _wrapCommandHandler(commandId: string, handler: CommandHandler): CommandHandler {
    return async (...args: unknown[]): Promise<unknown> => {
      try {
        // Validate arguments if parameter definitions exist
        const command = this._commands.get(commandId);
        if (command?.parameters) {
          this._validateCommandArguments(commandId, command.parameters, args);
        }

        return await handler(...args);
      } catch (error) {
        // Log the error but re-throw it
        this._logger.error(`Error in command handler ${commandId}:`, error as Error);
        throw error;
      }
    };
  }

  /**
   * Validate command arguments against parameter definitions
   */
  private _validateCommandArguments(
    commandId: string,
    parameters: NonNullable<CommandDefinition["parameters"]>,
    args: unknown[],
  ): void {
    const requiredParams = parameters.filter((p) => p.required);

    if (args.length < requiredParams.length) {
      throw new Error(
        `Command ${commandId} requires ${requiredParams.length} arguments, got ${args.length}`,
      );
    }

    for (let i = 0; i < parameters.length && i < args.length; i++) {
      const param = parameters[i];
      if (!param) continue;

      const arg = args[i];

      if (param.required && (arg === undefined || arg === null)) {
        throw new Error(`Command ${commandId} parameter ${param.name} is required`);
      }

      if (arg !== undefined && arg !== null && param.validator) {
        if (!param.validator(arg)) {
          throw new Error(`Command ${commandId} parameter ${param.name} validation failed`);
        }
      }
    }
  }
}
