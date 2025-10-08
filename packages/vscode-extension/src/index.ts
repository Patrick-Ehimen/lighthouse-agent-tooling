/**
 * Lighthouse VSCode Extension
 * @fileoverview Placeholder for VSCode extension implementation
 * 
 * This file serves as a placeholder until the VSCode extension is fully implemented.
 * The extension will provide Lighthouse integration for VSCode.
 */

import * as vscode from 'vscode';

/**
 * Main extension entry point
 * TODO: Implement VSCode extension functionality
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('Lighthouse VSCode Extension activated (placeholder)');
  
  // Placeholder command registration
  const disposable = vscode.commands.registerCommand('lighthouse.hello', () => {
    vscode.window.showInformationMessage('Lighthouse VSCode Extension (placeholder)');
  });
  
  context.subscriptions.push(disposable);
}

/**
 * Extension deactivation
 * TODO: Implement cleanup logic
 */
export function deactivate(): void {
  console.log('Lighthouse VSCode Extension deactivated (placeholder)');
}

// Placeholder exports to prevent TypeScript errors
export const extensionName = 'lighthouse-vscode-extension';
export const version = '0.1.0';
