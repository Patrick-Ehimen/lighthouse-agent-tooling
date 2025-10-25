/**
 * VSCode Workspace Provider
 * @fileoverview VSCode-specific implementation of workspace context provider
 */

import * as vscode from "vscode";
import * as path from "path";
import type {
  WorkspaceContextProvider,
  WorkspaceChangeCallback,
  WorkspaceWatcher,
  WorkspaceContext,
} from "../types/mock-types";

/**
 * VSCode workspace watcher implementation
 */
class VSCodeWorkspaceWatcher implements WorkspaceWatcher {
  constructor(private disposables: vscode.Disposable[]) {}

  dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables.length = 0;
  }
}

/**
 * VSCode workspace context provider implementation
 */
export class VSCodeWorkspaceProvider implements WorkspaceContextProvider {
  private watchers: VSCodeWorkspaceWatcher[] = [];

  /**
   * Get the current workspace context
   */
  async getContext(): Promise<WorkspaceContext> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const activeEditor = vscode.window.activeTextEditor;

    const context: WorkspaceContext = {
      workspacePath: workspaceFolders?.[0]?.uri.fsPath || "",
      workspaceName:
        vscode.workspace.name || path.basename(workspaceFolders?.[0]?.uri.fsPath || ""),
      activeFile: activeEditor?.document.uri.fsPath || null,
      openFiles: vscode.workspace.textDocuments.map((doc) => doc.uri.fsPath),
      projectFiles: await this.getWorkspaceFiles(),
      datasets: await this.getActiveDatasets(),
      gitInfo: await this.getGitInfo(),
      metadata: {
        vscodeVersion: vscode.version,
        extensionVersion:
          vscode.extensions.getExtension("lighthouse-web3.lighthouse-vscode-extension")?.packageJSON
            .version || "unknown",
        timestamp: new Date().toISOString(),
      },
    };

    return context;
  }

  /**
   * Refresh the workspace context
   */
  async refreshContext(): Promise<WorkspaceContext> {
    return this.getContext();
  }

  /**
   * Watch for workspace changes
   */
  watchWorkspace(callback: WorkspaceChangeCallback): WorkspaceWatcher {
    const disposables: vscode.Disposable[] = [];

    // Watch for file changes
    const fileWatcher = vscode.workspace.onDidChangeTextDocument(async () => {
      const context = await this.getContext();
      callback(context);
    });
    disposables.push(fileWatcher);

    // Watch for active editor changes
    const editorWatcher = vscode.window.onDidChangeActiveTextEditor(async () => {
      const context = await this.getContext();
      callback(context);
    });
    disposables.push(editorWatcher);

    // Watch for workspace folder changes
    const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      const context = await this.getContext();
      callback(context);
    });
    disposables.push(workspaceWatcher);

    const watcher = new VSCodeWorkspaceWatcher(disposables);
    this.watchers.push(watcher);
    return watcher;
  }

  /**
   * Get workspace files
   */
  async getWorkspaceFiles(): Promise<any[]> {
    try {
      const files = await vscode.workspace.findFiles(
        "**/*",
        "**/node_modules/**",
        1000, // Limit to prevent performance issues
      );

      return files.map((file) => ({
        path: file.fsPath,
        name: path.basename(file.fsPath),
        extension: path.extname(file.fsPath),
        size: 0, // VSCode doesn't provide file size directly
        lastModified: new Date(), // Would need fs.stat for actual date
        type: "file",
      }));
    } catch (error) {
      console.error("Error getting workspace files:", error);
      return [];
    }
  }

  /**
   * Get Lighthouse files (placeholder)
   */
  async getLighthouseFiles(): Promise<any[]> {
    // This would typically query the Lighthouse SDK for files
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Get active datasets (placeholder)
   */
  async getActiveDatasets(): Promise<any[]> {
    // This would typically query the Lighthouse SDK for datasets
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Get Git information
   */
  private async getGitInfo(): Promise<any> {
    try {
      const gitExtension = vscode.extensions.getExtension("vscode.git");
      if (!gitExtension) {
        return null;
      }

      const git = gitExtension.exports.getAPI(1);
      const repository = git.repositories[0];

      if (!repository) {
        return null;
      }

      return {
        branch: repository.state.HEAD?.name || "unknown",
        commit: repository.state.HEAD?.commit || "unknown",
        remotes: repository.state.remotes.map((remote: any) => ({
          name: remote.name,
          url: remote.fetchUrl || remote.pushUrl,
        })),
        changes: {
          modified: repository.state.workingTreeChanges.length,
          staged: repository.state.indexChanges.length,
        },
      };
    } catch (error) {
      console.error("Error getting Git info:", error);
      return null;
    }
  }

  /**
   * Dispose of all watchers
   */
  async dispose(): Promise<void> {
    this.watchers.forEach((watcher) => watcher.dispose());
    this.watchers.length = 0;
  }
}
