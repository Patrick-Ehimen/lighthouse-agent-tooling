/**
 * Settings provider implementation
 * @fileoverview Handles persistence of extension settings
 */

import type { ExtensionConfiguration } from "../types/index.js";
import { Logger } from "@lighthouse-tooling/shared";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

/**
 * Settings provider implementation
 */
export class SettingsProviderImpl {
  private _settingsPath: string;
  private _logger: Logger;

  constructor() {
    this._logger = new Logger({ level: "info", component: "SettingsProvider" });
    this._settingsPath = this._getSettingsPath();
  }

  /**
   * Load configuration from disk
   */
  async loadConfiguration(): Promise<Partial<ExtensionConfiguration> | null> {
    try {
      const content = await fs.readFile(this._settingsPath, "utf-8");
      const config = JSON.parse(content);
      this._logger.debug("Configuration loaded from disk");
      return config;
    } catch (error) {
      if ((error as any).code === "ENOENT") {
        this._logger.debug("No saved configuration found");
        return null;
      }
      this._logger.error("Failed to load configuration:", error as Error);
      return null;
    }
  }

  /**
   * Save configuration to disk
   */
  async saveConfiguration(config: ExtensionConfiguration): Promise<void> {
    try {
      // Ensure settings directory exists
      await this._ensureSettingsDirectory();

      // Save configuration
      const content = JSON.stringify(config, null, 2);
      await fs.writeFile(this._settingsPath, content, "utf-8");

      this._logger.debug("Configuration saved to disk");
    } catch (error) {
      this._logger.error("Failed to save configuration:", error as Error);
      throw error;
    }
  }

  /**
   * Get settings file path
   */
  private _getSettingsPath(): string {
    const homeDir = os.homedir();
    const settingsDir = path.join(homeDir, ".lighthouse-extension");
    return path.join(settingsDir, "settings.json");
  }

  /**
   * Ensure settings directory exists
   */
  private async _ensureSettingsDirectory(): Promise<void> {
    const settingsDir = path.dirname(this._settingsPath);

    try {
      await fs.access(settingsDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(settingsDir, { recursive: true });
      this._logger.debug(`Created settings directory: ${settingsDir}`);
    }
  }
}
