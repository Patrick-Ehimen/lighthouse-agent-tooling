/**
 * Configuration manager implementation
 * @fileoverview Manages extension configuration and settings
 */

import type {
  ConfigurationManager,
  ExtensionConfiguration,
  ConfigurationChangeCallback,
  ConfigurationWatcher,
} from "../types/index.js";
import { SettingsProviderImpl } from "./settings-provider.js";
import { Logger } from "@lighthouse-tooling/shared";

/**
 * Configuration watcher implementation
 */
class ConfigurationWatcherImpl implements ConfigurationWatcher {
  private _callback: ConfigurationChangeCallback;
  private _manager: ConfigurationManagerImpl;
  private _disposed = false;

  constructor(callback: ConfigurationChangeCallback, manager: ConfigurationManagerImpl) {
    this._callback = callback;
    this._manager = manager;
  }

  /**
   * Stop watching
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;
    this._manager.removeWatcher(this);
  }

  /**
   * Notify of configuration change
   */
  notify(config: ExtensionConfiguration): void {
    if (!this._disposed) {
      try {
        this._callback(config);
      } catch (error) {
        // Log error but don't throw
        console.error("Error in configuration watcher callback:", error as Error);
      }
    }
  }
}

/**
 * Configuration manager implementation
 */
export class ConfigurationManagerImpl implements ConfigurationManager {
  private _configuration: ExtensionConfiguration;
  private _settingsProvider: SettingsProviderImpl;
  private _watchers = new Set<ConfigurationWatcherImpl>();
  private _logger: Logger;

  constructor() {
    this._logger = new Logger({ level: "info", component: "ConfigurationManager" });
    this._settingsProvider = new SettingsProviderImpl();
    this._configuration = this._getDefaultConfiguration();
  }

  /**
   * Initialize the configuration manager
   */
  async initialize(): Promise<void> {
    try {
      this._logger.info("Initializing configuration manager...");

      // Load configuration from settings provider
      const savedConfig = await this._settingsProvider.loadConfiguration();
      if (savedConfig) {
        this._configuration = { ...this._configuration, ...savedConfig };
      }

      this._logger.info("Configuration manager initialized successfully");
    } catch (error) {
      this._logger.error("Failed to initialize configuration manager:", error as Error);
      // Continue with default configuration
    }
  }

  /**
   * Dispose of the configuration manager
   */
  async dispose(): Promise<void> {
    try {
      // Dispose all watchers
      for (const watcher of this._watchers) {
        watcher.dispose();
      }
      this._watchers.clear();

      this._logger.info("Configuration manager disposed");
    } catch (error) {
      this._logger.error("Error disposing configuration manager:", error as Error);
    }
  }

  /**
   * Get configuration
   */
  getConfiguration(): ExtensionConfiguration {
    return { ...this._configuration };
  }

  /**
   * Update configuration
   */
  async updateConfiguration(config: Partial<ExtensionConfiguration>): Promise<void> {
    try {
      const oldConfig = { ...this._configuration };
      this._configuration = { ...this._configuration, ...config };

      // Save to settings provider
      await this._settingsProvider.saveConfiguration(this._configuration);

      this._logger.debug("Configuration updated");

      // Notify watchers
      this._notifyWatchers(this._configuration);
    } catch (error) {
      this._logger.error("Failed to update configuration:", error as Error);
      throw error;
    }
  }

  /**
   * Watch for configuration changes
   */
  watchConfiguration(callback: ConfigurationChangeCallback): ConfigurationWatcher {
    const watcher = new ConfigurationWatcherImpl(callback, this);
    this._watchers.add(watcher);
    return watcher;
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfiguration(): Promise<void> {
    try {
      this._configuration = this._getDefaultConfiguration();

      // Save to settings provider
      await this._settingsProvider.saveConfiguration(this._configuration);

      this._logger.info("Configuration reset to defaults");

      // Notify watchers
      this._notifyWatchers(this._configuration);
    } catch (error) {
      this._logger.error("Failed to reset configuration:", error as Error);
      throw error;
    }
  }

  /**
   * Remove a watcher (internal use)
   */
  removeWatcher(watcher: ConfigurationWatcherImpl): void {
    this._watchers.delete(watcher);
  }

  /**
   * Notify all watchers of configuration changes
   */
  private _notifyWatchers(config: ExtensionConfiguration): void {
    for (const watcher of this._watchers) {
      watcher.notify(config);
    }
  }

  /**
   * Get default configuration
   */
  private _getDefaultConfiguration(): ExtensionConfiguration {
    return {
      lighthouse: {
        apiEndpoint: "https://node.lighthouse.storage",
        encryption: {
          enabled: false,
          algorithm: "AES-256-GCM",
          keyManagement: {
            storageMethod: "local",
            rotation: {
              enabled: false,
              intervalDays: 30,
            },
          },
        },
        upload: {
          maxFileSize: 100 * 1024 * 1024, // 100MB
          chunkSize: 1024 * 1024, // 1MB
          maxConcurrentUploads: 3,
          timeout: 300000, // 5 minutes
        },
        download: {
          directory: "./downloads",
          maxConcurrentDownloads: 3,
          timeout: 300000, // 5 minutes
        },
      },
      ai: {
        enabledAgents: ["cursor_ai", "claude_assistant"],
        preferences: {
          autoSync: false,
          preferredFileTypes: [".py", ".js", ".ts", ".json", ".csv"],
          notifications: {
            showProgress: true,
            showCompletion: true,
            showErrors: true,
          },
        },
        commandTimeout: 60000, // 1 minute
      },
      workspace: {
        autoDiscovery: {
          enabled: true,
          includePatterns: ["**/*"],
          excludePatterns: ["node_modules/**", ".git/**", "dist/**", "build/**", "coverage/**"],
        },
        fileWatching: {
          enabled: true,
          debounceDelay: 300,
          watchPatterns: ["**/*"],
        },
        gitIntegration: {
          enabled: true,
          trackChanges: true,
          includeCommitInfo: true,
        },
      },
      ui: {
        theme: {
          colorScheme: "auto",
          accentColor: "#007ACC",
        },
        layout: {
          panelPosition: "left",
          panelWidth: 300,
          showStatusBar: true,
        },
        animations: {
          enabled: true,
          duration: 200,
        },
      },
      performance: {
        cache: {
          enabled: true,
          sizeLimit: 50, // 50MB
          ttl: 300000, // 5 minutes
        },
        memory: {
          limit: 100, // 100MB
          gc: {
            aggressive: false,
            interval: 60000, // 1 minute
          },
        },
        network: {
          timeout: 30000, // 30 seconds
          maxRetries: 3,
          retryDelay: 1000, // 1 second
        },
      },
    };
  }
}
