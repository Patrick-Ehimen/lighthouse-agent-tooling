/**
 * Command registry tests
 * @fileoverview Tests for the command registry functionality
 */

import { CommandRegistryImpl } from "../src/core/command-registry";
import { ExtensionEventEmitter } from "../src/events/event-emitter";
import type { CommandDefinition } from "../src/types/index";

describe("CommandRegistry", () => {
  let commandRegistry: CommandRegistryImpl;
  let eventEmitter: ExtensionEventEmitter;

  beforeEach(() => {
    eventEmitter = new ExtensionEventEmitter();
    commandRegistry = new CommandRegistryImpl(eventEmitter);
  });

  describe("command registration", () => {
    it("should register a command successfully", () => {
      const command: CommandDefinition = {
        id: "test.command",
        title: "Test Command",
        handler: jest.fn(),
      };

      commandRegistry.registerCommand(command);

      expect(commandRegistry.hasCommand("test.command")).toBe(true);
      expect(commandRegistry.getCommands()).toHaveLength(1);
    });

    it("should throw error for invalid command definition", () => {
      const invalidCommand = {
        title: "Invalid Command",
        handler: jest.fn(),
      } as CommandDefinition;

      expect(() => commandRegistry.registerCommand(invalidCommand)).toThrow();
    });

    it("should unregister a command", () => {
      const command: CommandDefinition = {
        id: "test.command",
        title: "Test Command",
        handler: jest.fn(),
      };

      commandRegistry.registerCommand(command);
      expect(commandRegistry.hasCommand("test.command")).toBe(true);

      commandRegistry.unregisterCommand("test.command");
      expect(commandRegistry.hasCommand("test.command")).toBe(false);
    });
  });

  describe("command execution", () => {
    it("should execute a registered command", async () => {
      const mockHandler = jest.fn().mockResolvedValue("success");
      const command: CommandDefinition = {
        id: "test.command",
        title: "Test Command",
        handler: mockHandler,
      };

      commandRegistry.registerCommand(command);

      const result = await commandRegistry.executeCommand("test.command", "arg1", "arg2");

      expect(mockHandler).toHaveBeenCalledWith("arg1", "arg2");
      expect(result).toBe("success");
    });

    it("should throw error for unregistered command", async () => {
      await expect(commandRegistry.executeCommand("nonexistent.command")).rejects.toThrow(
        "Command nonexistent.command is not registered",
      );
    });

    it("should throw error for disabled command", async () => {
      const command: CommandDefinition = {
        id: "test.command",
        title: "Test Command",
        handler: jest.fn(),
        enabled: false,
      };

      commandRegistry.registerCommand(command);

      await expect(commandRegistry.executeCommand("test.command")).rejects.toThrow(
        "Command test.command is disabled",
      );
    });
  });
});
