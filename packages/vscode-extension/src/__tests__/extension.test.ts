/**
 * VSCode Extension Tests
 * @fileoverview Basic tests for the VSCode extension
 */

import * as vscode from "vscode";
import { LighthouseVSCodeExtension } from "../extension";

describe("LighthouseVSCodeExtension", () => {
  let mockContext: vscode.ExtensionContext;
  let extension: LighthouseVSCodeExtension;

  beforeEach(() => {
    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: jest.fn(),
        update: jest.fn(),
      },
      globalState: {
        get: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    // Mock workspace configuration to return API key
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn((key: string) => {
        if (key === "apiKey") return "test-api-key";
        if (key === "mcpServerUrl") return "http://localhost:3000";
        return undefined;
      }),
      update: jest.fn(),
    });

    extension = new LighthouseVSCodeExtension(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("activation", () => {
    it("should activate successfully", async () => {
      await expect(extension.activate()).resolves.not.toThrow();
    });

    it("should register commands during activation", async () => {
      await extension.activate();

      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        "lighthouse.vscode.uploadFile",
        expect.any(Function),
      );
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        "lighthouse.vscode.createDataset",
        expect.any(Function),
      );
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        "lighthouse.vscode.connectMCP",
        expect.any(Function),
      );
    });

    it("should setup UI components during activation", async () => {
      await extension.activate();

      expect(vscode.window.registerTreeDataProvider).toHaveBeenCalledWith(
        "lighthouseFiles",
        expect.any(Object),
      );
      expect(vscode.window.createTreeView).toHaveBeenCalledWith(
        "lighthouseFiles",
        expect.any(Object),
      );
    });
  });

  describe("deactivation", () => {
    it("should deactivate successfully", async () => {
      await extension.activate();
      await expect(extension.deactivate()).resolves.not.toThrow();
    });

    it("should not throw if deactivating before activation", async () => {
      await expect(extension.deactivate()).resolves.not.toThrow();
    });
  });

  describe("command handling", () => {
    beforeEach(async () => {
      await extension.activate();
    });

    it("should handle invalid file data gracefully", async () => {
      const handleOpenFile = (extension as any).handleOpenFile;

      await handleOpenFile(null);
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Invalid file data");

      await handleOpenFile({});
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Invalid file data");
    });

    it("should handle invalid dataset data gracefully", async () => {
      const handleOpenDataset = (extension as any).handleOpenDataset;

      await handleOpenDataset(null);
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Invalid dataset data");

      await handleOpenDataset({});
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Invalid dataset data");
    });
  });

  describe("utility methods", () => {
    it("should map file extensions to languages correctly", () => {
      const getLanguageFromExtension = (extension as any).getLanguageFromExtension;

      expect(getLanguageFromExtension("test.js")).toBe("javascript");
      expect(getLanguageFromExtension("test.ts")).toBe("typescript");
      expect(getLanguageFromExtension("test.py")).toBe("python");
      expect(getLanguageFromExtension("test.json")).toBe("json");
      expect(getLanguageFromExtension("test.unknown")).toBe("plaintext");
      expect(getLanguageFromExtension("test")).toBe("plaintext");
    });
  });
});
