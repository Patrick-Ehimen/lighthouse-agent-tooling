/**
 * Lighthouse VSCode Extension
 * @fileoverview VSCode extension entry point with AI integration
 */

import * as vscode from "vscode";
import { LighthouseVSCodeExtension } from "./extension";

let extension: LighthouseVSCodeExtension | undefined;

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    extension = new LighthouseVSCodeExtension(context);
    await extension.activate();
    console.log("Lighthouse VSCode Extension activated successfully");
  } catch (error) {
    console.error("Failed to activate Lighthouse VSCode Extension:", error);
    vscode.window.showErrorMessage(
      `Failed to activate Lighthouse extension: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Extension deactivation
 */
export async function deactivate(): Promise<void> {
  try {
    if (extension) {
      await extension.deactivate();
      extension = undefined;
    }
    console.log("Lighthouse VSCode Extension deactivated");
  } catch (error) {
    console.error("Error during extension deactivation:", error);
  }
}
