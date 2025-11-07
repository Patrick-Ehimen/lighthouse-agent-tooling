/**
 * VSCode Tree Provider
 * @fileoverview Tree view provider for Lighthouse files and datasets
 */

import * as vscode from "vscode";
import * as path from "path";
import type { LighthouseAISDK } from "@lighthouse-tooling/sdk-wrapper";

/**
 * Tree item types
 */
enum TreeItemType {
  Root = "root",
  Files = "files",
  Datasets = "datasets",
  File = "file",
  Dataset = "dataset",
}

/**
 * Lighthouse tree item
 */
class LighthouseTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly type: TreeItemType,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly data?: any,
  ) {
    super(label, collapsibleState);

    this.contextValue = type;
    this.tooltip = this.getTooltip();
    this.iconPath = this.getIcon();
    this.command = this.getCommand();
  }

  private getTooltip(): string {
    switch (this.type) {
      case TreeItemType.File:
        return `File: ${this.data?.name || this.label}\nHash: ${this.data?.hash || "Unknown"}\nSize: ${this.data?.size || "Unknown"}`;
      case TreeItemType.Dataset:
        return `Dataset: ${this.data?.name || this.label}\nFiles: ${this.data?.fileCount || 0}\nCreated: ${this.data?.createdAt || "Unknown"}`;
      default:
        return this.label;
    }
  }

  private getIcon(): vscode.ThemeIcon {
    switch (this.type) {
      case TreeItemType.Files:
        return new vscode.ThemeIcon("files");
      case TreeItemType.Datasets:
        return new vscode.ThemeIcon("database");
      case TreeItemType.File:
        return new vscode.ThemeIcon("file");
      case TreeItemType.Dataset:
        return new vscode.ThemeIcon("folder-library");
      default:
        return new vscode.ThemeIcon("folder");
    }
  }

  private getCommand(): vscode.Command | undefined {
    switch (this.type) {
      case TreeItemType.File:
        return {
          command: "lighthouse.vscode.openFile",
          title: "Open File",
          arguments: [this.data],
        };
      case TreeItemType.Dataset:
        return {
          command: "lighthouse.vscode.openDataset",
          title: "Open Dataset",
          arguments: [this.data],
        };
      default:
        return undefined;
    }
  }
}

/**
 * VSCode tree data provider for Lighthouse files
 */
export class VSCodeTreeProvider implements vscode.TreeDataProvider<LighthouseTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<LighthouseTreeItem | undefined | null | void> =
    new vscode.EventEmitter<LighthouseTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<LighthouseTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private files: any[] = [];
  private datasets: any[] = [];

  constructor(private sdk: LighthouseAISDK) {}

  /**
   * Initialize the tree provider
   */
  async initialize(): Promise<void> {
    await this.loadData();
  }

  /**
   * Get tree item
   */
  getTreeItem(element: LighthouseTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children
   */
  async getChildren(element?: LighthouseTreeItem): Promise<LighthouseTreeItem[]> {
    if (!element) {
      // Root level
      return [
        new LighthouseTreeItem(
          `Files (${this.files.length})`,
          TreeItemType.Files,
          vscode.TreeItemCollapsibleState.Expanded,
        ),
        new LighthouseTreeItem(
          `Datasets (${this.datasets.length})`,
          TreeItemType.Datasets,
          vscode.TreeItemCollapsibleState.Expanded,
        ),
      ];
    }

    switch (element.type) {
      case TreeItemType.Files:
        return this.files.map(
          (file) =>
            new LighthouseTreeItem(
              file.name || file.hash,
              TreeItemType.File,
              vscode.TreeItemCollapsibleState.None,
              file,
            ),
        );

      case TreeItemType.Datasets:
        return this.datasets.map(
          (dataset) =>
            new LighthouseTreeItem(
              dataset.name,
              TreeItemType.Dataset,
              vscode.TreeItemCollapsibleState.None,
              dataset,
            ),
        );

      default:
        return [];
    }
  }

  /**
   * Refresh the tree
   */
  async refresh(): Promise<void> {
    await this.loadData();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Load data from SDK
   */
  private async loadData(): Promise<void> {
    try {
      // Load files (this would be implemented in the SDK)
      this.files = await this.loadFiles();

      // Load datasets
      this.datasets = await this.loadDatasets();
    } catch (error) {
      console.error("Error loading tree data:", error);
      this.files = [];
      this.datasets = [];
    }
  }

  /**
   * Load files from SDK
   */
  private async loadFiles(): Promise<any[]> {
    try {
      // Use the actual SDK listFiles method to get real uploaded files
      const response = await this.sdk.listFiles(100, 0); // Get up to 100 files
      return response.files.map((file) => ({
        hash: file.hash,
        name: file.name,
        size: this.formatBytes(file.size),
        uploadedAt: file.uploadedAt,
      }));
    } catch (error) {
      console.error("Error loading files:", error);
      return [];
    }
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Load datasets from SDK
   */
  private async loadDatasets(): Promise<any[]> {
    try {
      // For now, return mock datasets since SDK doesn't have dataset methods yet
      return [
        {
          id: "dataset-1",
          name: "AI Training Data",
          description: "Dataset for machine learning training",
          files: [],
          fileCount: 0,
          createdAt: new Date().toISOString(),
        },
        {
          id: "dataset-2",
          name: "Document Collection",
          description: "Collection of documents for analysis",
          files: [],
          fileCount: 0,
          createdAt: new Date().toISOString(),
        },
      ];

      // TODO: Implement actual dataset listing when SDK supports it
    } catch (error) {
      console.error("Error loading datasets:", error);
      return [];
    }
  }

  /**
   * Dispose of the tree provider
   */
  async dispose(): Promise<void> {
    this._onDidChangeTreeData.dispose();
  }
}
