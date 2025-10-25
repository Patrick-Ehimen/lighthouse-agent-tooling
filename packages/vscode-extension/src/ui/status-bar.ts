/**
 * VSCode Status Bar
 * @fileoverview Status bar integration for Lighthouse operations
 */

import * as vscode from "vscode";

/**
 * VSCode status bar manager
 */
export class VSCodeStatusBar {
  private statusBarItem: vscode.StatusBarItem;
  private hideTimeout?: NodeJS.Timeout;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = "lighthouse.vscode.refreshTree";
  }

  /**
   * Initialize the status bar
   */
  async initialize(): Promise<void> {
    this.statusBarItem.text = "$(cloud) Lighthouse";
    this.statusBarItem.tooltip = "Lighthouse Storage - Click to refresh";
    this.statusBarItem.show();
  }

  /**
   * Show success message
   */
  showSuccess(message: string, duration = 3000): void {
    this.statusBarItem.text = `$(check) ${message}`;
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.color = new vscode.ThemeColor("statusBarItem.prominentForeground");

    this.clearHideTimeout();
    this.hideTimeout = setTimeout(() => {
      this.reset();
    }, duration);
  }

  /**
   * Show error message
   */
  showError(message: string, duration = 5000): void {
    this.statusBarItem.text = `$(error) ${message}`;
    this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
    this.statusBarItem.color = new vscode.ThemeColor("statusBarItem.errorForeground");

    this.clearHideTimeout();
    this.hideTimeout = setTimeout(() => {
      this.reset();
    }, duration);
  }

  /**
   * Show warning message
   */
  showWarning(message: string, duration = 4000): void {
    this.statusBarItem.text = `$(warning) ${message}`;
    this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    this.statusBarItem.color = new vscode.ThemeColor("statusBarItem.warningForeground");

    this.clearHideTimeout();
    this.hideTimeout = setTimeout(() => {
      this.reset();
    }, duration);
  }

  /**
   * Show progress message
   */
  showProgress(message: string): void {
    this.statusBarItem.text = `$(sync~spin) ${message}`;
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.color = undefined;
    this.clearHideTimeout();
  }

  /**
   * Reset to default state
   */
  reset(): void {
    this.statusBarItem.text = "$(cloud) Lighthouse";
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.color = undefined;
    this.statusBarItem.tooltip = "Lighthouse Storage - Click to refresh";
    this.clearHideTimeout();
  }

  /**
   * Clear hide timeout
   */
  private clearHideTimeout(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = undefined;
    }
  }

  /**
   * Dispose of the status bar
   */
  async dispose(): Promise<void> {
    this.clearHideTimeout();
    this.statusBarItem.dispose();
  }
}
