/**
 * Workspace context provider implementation
 * @fileoverview Provides workspace context information for AI agents
 */

import type {
  WorkspaceContextProvider,
  WorkspaceChangeCallback,
  WorkspaceWatcher,
  ConfigurationManager,
} from "../types/index.js";
import type {
  WorkspaceContext,
  ProjectFile,
  DatasetReference,
  GitInfo,
  WorkspaceMetadata,
  WorkspaceConfiguration,
} from "@lighthouse-tooling/types";
import type { ExtensionEventEmitter } from "../events/event-emitter.js";
import { FileWatcherImpl } from "./file-watcher.js";
import { GitIntegrationImpl } from "./git-integration.js";
import { Logger, FileUtils } from "@lighthouse-tooling/shared";
import * as path from "path";
import * as fs from "fs/promises";

/**
 * Workspace watcher implementation
 */
class WorkspaceWatcherImpl implements WorkspaceWatcher {
  private _disposed = false;
  private _fileWatcher: FileWatcherImpl;
  private _callback: WorkspaceChangeCallback;
  private _contextProvider: WorkspaceContextProviderImpl;

  constructor(
    fileWatcher: FileWatcherImpl,
    callback: WorkspaceChangeCallback,
    contextProvider: WorkspaceContextProviderImpl,
  ) {
    this._fileWatcher = fileWatcher;
    this._callback = callback;
    this._contextProvider = contextProvider;

    // Set up file watcher callback
    this._fileWatcher.onFileChanged(async () => {
      if (!this._disposed) {
        const context = await this._contextProvider.getContext();
        this._callback(context);
      }
    });
  }

  /**
   * Stop watching
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;
    this._fileWatcher.dispose();
  }
}

/**
 * Workspace context provider implementation
 */
export class WorkspaceContextProviderImpl implements WorkspaceContextProvider {
  private _workspacePath: string;
  private _cachedContext: WorkspaceContext | null = null;
  private _cacheTimestamp = 0;
  private _cacheTtl = 30000; // 30 seconds
  private _fileWatcher: FileWatcherImpl;
  private _gitIntegration: GitIntegrationImpl;
  private _eventEmitter: ExtensionEventEmitter;
  private _configurationManager: ConfigurationManager;
  private _logger: Logger;

  constructor(
    eventEmitter: ExtensionEventEmitter,
    configurationManager: ConfigurationManager,
    workspacePath?: string,
  ) {
    this._workspacePath = workspacePath || process.cwd();
    this._eventEmitter = eventEmitter;
    this._configurationManager = configurationManager;
    this._logger = new Logger({ level: "info", component: "WorkspaceContextProvider" });
    this._fileWatcher = new FileWatcherImpl(this._workspacePath);
    this._gitIntegration = new GitIntegrationImpl(this._workspacePath);
  }

  /**
   * Initialize the context provider
   */
  async initialize(): Promise<void> {
    try {
      this._logger.info(`Initializing workspace context provider for: ${this._workspacePath}`);

      // Initialize Git integration
      await this._gitIntegration.initialize();

      // Initialize file watcher
      await this._fileWatcher.initialize();

      // Load initial context
      await this.refreshContext();

      this._logger.info("Workspace context provider initialized successfully");
    } catch (error) {
      this._logger.error("Failed to initialize workspace context provider:", error as Error);
      throw error;
    }
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    try {
      this._fileWatcher.dispose();
      await this._gitIntegration.dispose();
      this._cachedContext = null;
      this._logger.info("Workspace context provider disposed");
    } catch (error) {
      this._logger.error("Error disposing workspace context provider:", error as Error);
    }
  }

  /**
   * Get the current workspace context
   */
  async getContext(): Promise<WorkspaceContext> {
    // Return cached context if still valid
    if (this._cachedContext && Date.now() - this._cacheTimestamp < this._cacheTtl) {
      return this._cachedContext;
    }

    return this.refreshContext();
  }

  /**
   * Refresh the workspace context
   */
  async refreshContext(): Promise<WorkspaceContext> {
    try {
      this._logger.debug("Refreshing workspace context...");

      const [gitInfo, lighthouseFiles, activeDatasets, metadata, configuration] = await Promise.all(
        [
          this._getGitInfo(),
          this.getLighthouseFiles(),
          this.getActiveDatasets(),
          this._getWorkspaceMetadata(),
          this._getWorkspaceConfiguration(),
        ],
      );

      this._cachedContext = {
        projectPath: this._workspacePath,
        gitInfo,
        lighthouseFiles,
        activeDatasets,
        metadata,
        configuration,
      };

      this._cacheTimestamp = Date.now();
      this._logger.debug("Workspace context refreshed successfully");

      // Emit context refreshed event
      this._eventEmitter.emit("workspace.context.refreshed", {
        type: "workspace.context.refreshed",
        data: this._cachedContext,
        timestamp: new Date(),
        source: "WorkspaceContextProvider",
      });

      return this._cachedContext;
    } catch (error) {
      this._logger.error("Failed to refresh workspace context:", error as Error);
      throw error;
    }
  }

  /**
   * Watch for workspace changes
   */
  watchWorkspace(callback: WorkspaceChangeCallback): WorkspaceWatcher {
    return new WorkspaceWatcherImpl(this._fileWatcher, callback, this);
  }

  /**
   * Get workspace files
   */
  async getWorkspaceFiles(): Promise<ProjectFile[]> {
    try {
      const files = await this._scanDirectory(this._workspacePath);
      return files;
    } catch (error) {
      this._logger.error("Failed to get workspace files:", error as Error);
      return [];
    }
  }

  /**
   * Get Lighthouse files
   */
  async getLighthouseFiles(): Promise<ProjectFile[]> {
    try {
      const allFiles = await this.getWorkspaceFiles();

      // Filter for files that might be Lighthouse-related
      const lighthouseFiles = allFiles.filter((file) => {
        // Check for common data file extensions
        const dataExtensions = [".csv", ".json", ".parquet", ".txt", ".md", ".py", ".js", ".ts"];
        const hasDataExtension = dataExtensions.includes(file.extension.toLowerCase());

        // Check for Lighthouse metadata files
        const isLighthouseMetadata =
          file.name.includes(".lighthouse") || file.name.includes("lighthouse-");

        // Check for dataset directories
        const isInDatasetDir =
          file.path.includes("/datasets/") ||
          file.path.includes("/data/") ||
          file.path.includes("/models/");

        return hasDataExtension || isLighthouseMetadata || isInDatasetDir;
      });

      // Add Lighthouse-specific metadata
      for (const file of lighthouseFiles) {
        file.lighthouseMetadata = await this._getLighthouseFileMetadata(file);
      }

      return lighthouseFiles;
    } catch (error) {
      this._logger.error("Failed to get Lighthouse files:", error as Error);
      return [];
    }
  }

  /**
   * Get active datasets
   */
  async getActiveDatasets(): Promise<DatasetReference[]> {
    try {
      const datasets: DatasetReference[] = [];

      // Look for dataset configuration files
      const configFiles = await this._findFiles(this._workspacePath, [
        "lighthouse-datasets.json",
        "datasets.json",
        ".lighthouse/datasets.json",
      ]);

      for (const configFile of configFiles) {
        try {
          const content = await fs.readFile(configFile, "utf-8");
          const config = JSON.parse(content);

          if (config.datasets && Array.isArray(config.datasets)) {
            datasets.push(...config.datasets);
          }
        } catch (error) {
          this._logger.warn(`Failed to parse dataset config ${configFile}:`, error as Error);
        }
      }

      // Look for dataset directories
      const datasetDirs = await this._findDirectories(this._workspacePath, [
        "datasets",
        "data",
        "models",
      ]);

      for (const dir of datasetDirs) {
        const dirStats = await fs.stat(dir);
        const files = await this._scanDirectory(dir);

        datasets.push({
          id: path.basename(dir),
          name: path.basename(dir),
          description: `Dataset directory: ${path.relative(this._workspacePath, dir)}`,
          localPath: path.relative(this._workspacePath, dir),
          fileCount: files.length,
          totalSize: files.reduce((sum, file) => sum + file.size, 0),
          version: "1.0.0",
          encrypted: false,
          tags: ["local"],
          lastModified: dirStats.mtime,
          status: "ACTIVE" as any,
        });
      }

      return datasets;
    } catch (error) {
      this._logger.error("Failed to get active datasets:", error as Error);
      return [];
    }
  }

  /**
   * Get Git information
   */
  private async _getGitInfo(): Promise<GitInfo | undefined> {
    try {
      return await this._gitIntegration.getGitInfo();
    } catch (error) {
      this._logger.debug("No Git information available:", error as Error);
      return undefined;
    }
  }

  /**
   * Get workspace metadata
   */
  private async _getWorkspaceMetadata(): Promise<WorkspaceMetadata> {
    try {
      const packageJsonPath = path.join(this._workspacePath, "package.json");
      let packageJson: any = {};

      try {
        const content = await fs.readFile(packageJsonPath, "utf-8");
        packageJson = JSON.parse(content);
      } catch {
        // No package.json found, use defaults
      }

      const files = await this.getWorkspaceFiles();
      const languages = this._detectLanguages(files);
      const frameworks = await this._detectFrameworks();
      const dependencies = await this._detectDependencies();

      return {
        name: packageJson.name || path.basename(this._workspacePath),
        description: packageJson.description,
        type: this._detectWorkspaceType(files, frameworks),
        languages,
        frameworks,
        dependencies,
        size: files.reduce((sum, file) => sum + file.size, 0),
        fileCount: files.length,
        lastActivity: new Date(),
        tags: packageJson.keywords || [],
      };
    } catch (error) {
      this._logger.error("Failed to get workspace metadata:", error as Error);

      // Return minimal metadata
      return {
        name: path.basename(this._workspacePath),
        type: "GENERAL" as any,
        languages: [],
        frameworks: [],
        dependencies: [],
        size: 0,
        fileCount: 0,
        lastActivity: new Date(),
        tags: [],
      };
    }
  }

  /**
   * Get workspace configuration
   */
  private async _getWorkspaceConfiguration(): Promise<any> {
    const config = this._configurationManager.getConfiguration();
    return config.workspace;
  }

  /**
   * Scan directory for files
   */
  private async _scanDirectory(dirPath: string, maxDepth = 3): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];

    try {
      await this._scanDirectoryRecursive(dirPath, this._workspacePath, files, 0, maxDepth);
    } catch (error) {
      this._logger.error(`Failed to scan directory ${dirPath}:`, error as Error);
    }

    return files;
  }

  /**
   * Recursively scan directory
   */
  private async _scanDirectoryRecursive(
    currentPath: string,
    rootPath: string,
    files: ProjectFile[],
    depth: number,
    maxDepth: number,
  ): Promise<void> {
    if (depth > maxDepth) {
      return;
    }

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(rootPath, fullPath);

        // Skip hidden files and common ignore patterns
        if (this._shouldIgnoreFile(entry.name, relativePath)) {
          continue;
        }

        if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath);
            const file: ProjectFile = {
              path: relativePath,
              absolutePath: fullPath,
              name: entry.name,
              extension: path.extname(entry.name),
              size: stats.size,
              modifiedAt: stats.mtime,
              createdAt: stats.birthtime,
              isBinary: false, // TODO: implement binary file detection
              permissions: {
                readable: true,
                writable: true,
                executable: false,
                owner: { read: true, write: true, execute: false },
                group: { read: true, write: false, execute: false },
                other: { read: true, write: false, execute: false },
              },
            };

            files.push(file);
          } catch (error) {
            this._logger.debug(`Failed to stat file ${fullPath}:`, error as Error);
          }
        } else if (entry.isDirectory()) {
          await this._scanDirectoryRecursive(fullPath, rootPath, files, depth + 1, maxDepth);
        }
      }
    } catch (error) {
      this._logger.debug(`Failed to read directory ${currentPath}:`, error as Error);
    }
  }

  /**
   * Check if file should be ignored
   */
  private _shouldIgnoreFile(name: string, relativePath: string): boolean {
    const ignorePatterns = [
      /^\./, // Hidden files
      /node_modules/,
      /\.git/,
      /dist/,
      /build/,
      /coverage/,
      /\.turbo/,
      /\.next/,
      /\.nuxt/,
      /\.vscode/,
      /\.idea/,
    ];

    return ignorePatterns.some((pattern) => pattern.test(name) || pattern.test(relativePath));
  }

  /**
   * Get Lighthouse file metadata
   */
  private async _getLighthouseFileMetadata(file: ProjectFile): Promise<any> {
    // This would integrate with the actual Lighthouse service
    // For now, return basic metadata
    return {
      pinned: false,
      encrypted: false,
      tags: [],
    };
  }

  /**
   * Find specific files in workspace
   */
  private async _findFiles(rootPath: string, filenames: string[]): Promise<string[]> {
    const found: string[] = [];

    for (const filename of filenames) {
      const fullPath = path.join(rootPath, filename);
      try {
        await fs.access(fullPath);
        found.push(fullPath);
      } catch {
        // File doesn't exist
      }
    }

    return found;
  }

  /**
   * Find directories in workspace
   */
  private async _findDirectories(rootPath: string, dirnames: string[]): Promise<string[]> {
    const found: string[] = [];

    for (const dirname of dirnames) {
      const fullPath = path.join(rootPath, dirname);
      try {
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
          found.push(fullPath);
        }
      } catch {
        // Directory doesn't exist
      }
    }

    return found;
  }

  /**
   * Detect programming languages
   */
  private _detectLanguages(files: ProjectFile[]): string[] {
    const languageMap: Record<string, string> = {
      ".js": "JavaScript",
      ".ts": "TypeScript",
      ".py": "Python",
      ".java": "Java",
      ".cpp": "C++",
      ".c": "C",
      ".cs": "C#",
      ".go": "Go",
      ".rs": "Rust",
      ".php": "PHP",
      ".rb": "Ruby",
      ".swift": "Swift",
      ".kt": "Kotlin",
      ".scala": "Scala",
      ".r": "R",
      ".m": "MATLAB",
      ".sh": "Shell",
      ".sql": "SQL",
      ".html": "HTML",
      ".css": "CSS",
      ".scss": "SCSS",
      ".less": "LESS",
    };

    const languages = new Set<string>();

    for (const file of files) {
      const language = languageMap[file.extension.toLowerCase()];
      if (language) {
        languages.add(language);
      }
    }

    return Array.from(languages);
  }

  /**
   * Detect frameworks
   */
  private async _detectFrameworks(): Promise<any[]> {
    const frameworks: any[] = [];

    try {
      const packageJsonPath = path.join(this._workspacePath, "package.json");
      const content = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      const frameworkMap: Record<string, { name: string; type: string }> = {
        react: { name: "React", type: "frontend" },
        vue: { name: "Vue.js", type: "frontend" },
        angular: { name: "Angular", type: "frontend" },
        svelte: { name: "Svelte", type: "frontend" },
        next: { name: "Next.js", type: "full_stack" },
        nuxt: { name: "Nuxt.js", type: "full_stack" },
        express: { name: "Express.js", type: "backend" },
        fastify: { name: "Fastify", type: "backend" },
        nestjs: { name: "NestJS", type: "backend" },
        jest: { name: "Jest", type: "testing" },
        vitest: { name: "Vitest", type: "testing" },
        webpack: { name: "Webpack", type: "build_tool" },
        vite: { name: "Vite", type: "build_tool" },
      };

      for (const [dep, version] of Object.entries(allDeps)) {
        const framework = frameworkMap[dep];
        if (framework) {
          frameworks.push({
            name: framework.name,
            version: version as string,
            type: framework.type,
            isDevDependency: !!packageJson.devDependencies?.[dep],
          });
        }
      }
    } catch {
      // No package.json or parsing error
    }

    return frameworks;
  }

  /**
   * Detect dependencies
   */
  private async _detectDependencies(): Promise<any[]> {
    const dependencies: any[] = [];

    try {
      const packageJsonPath = path.join(this._workspacePath, "package.json");
      const content = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      for (const [name, version] of Object.entries(packageJson.dependencies || {})) {
        dependencies.push({
          name,
          version: version as string,
          type: "runtime",
          isDevDependency: false,
        });
      }

      for (const [name, version] of Object.entries(packageJson.devDependencies || {})) {
        dependencies.push({
          name,
          version: version as string,
          type: "development",
          isDevDependency: true,
        });
      }
    } catch {
      // No package.json or parsing error
    }

    return dependencies;
  }

  /**
   * Detect workspace type
   */
  private _detectWorkspaceType(files: ProjectFile[], frameworks: any[]): any {
    // Check for ML/Data Science indicators
    const mlFiles = files.filter(
      (f) =>
        f.name.includes("model") ||
        f.name.includes("dataset") ||
        f.extension === ".ipynb" ||
        f.extension === ".py",
    );

    if (mlFiles.length > 0) {
      return "ml_project";
    }

    // Check frameworks
    const frontendFrameworks = frameworks.filter((f) => f.type === "frontend");
    const backendFrameworks = frameworks.filter((f) => f.type === "backend");

    if (frontendFrameworks.length > 0 && backendFrameworks.length > 0) {
      return "web_app";
    } else if (frontendFrameworks.length > 0) {
      return "web_app";
    } else if (backendFrameworks.length > 0) {
      return "web_app";
    }

    return "general";
  }
}
