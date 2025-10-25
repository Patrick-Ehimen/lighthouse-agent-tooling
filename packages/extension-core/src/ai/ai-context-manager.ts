/**
 * AI context manager implementation
 * @fileoverview Manages AI context and session information
 */

import type { AIContext, AISession, AIPreferences } from "@lighthouse-tooling/types";
import { Logger } from "@lighthouse-tooling/shared";

/**
 * AI context manager implementation
 */
export class AIContextManagerImpl {
  private _currentContext: AIContext | null = null;
  private _logger: Logger;

  constructor() {
    this._logger = new Logger({ level: "info", component: "AIContextManager" });
  }

  /**
   * Get current AI context
   */
  getCurrentContext(): AIContext | null {
    return this._currentContext;
  }

  /**
   * Set AI context
   */
  setContext(context: AIContext): void {
    this._currentContext = context;
    this._logger.debug(`AI context set for agent: ${context.agentId}`);
  }

  /**
   * Update AI session
   */
  updateSession(sessionUpdate: Partial<AISession>): void {
    if (!this._currentContext) {
      this._logger.warn("No AI context available to update session");
      return;
    }

    this._currentContext.session = {
      ...this._currentContext.session,
      ...sessionUpdate,
      lastActivity: new Date(),
    };

    this._logger.debug("AI session updated");
  }

  /**
   * Update AI preferences
   */
  updatePreferences(preferences: Partial<AIPreferences>): void {
    if (!this._currentContext) {
      this._logger.warn("No AI context available to update preferences");
      return;
    }

    this._currentContext.preferences = {
      ...this._currentContext.preferences,
      ...preferences,
    };

    this._logger.debug("AI preferences updated");
  }

  /**
   * Add history entry
   */
  addHistoryEntry(entry: any): void {
    if (!this._currentContext) {
      this._logger.warn("No AI context available to add history entry");
      return;
    }

    this._currentContext.history.push(entry);

    // Keep only the last 100 entries
    if (this._currentContext.history.length > 100) {
      this._currentContext.history = this._currentContext.history.slice(-100);
    }

    this._logger.debug("AI history entry added");
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this._currentContext = null;
    this._logger.debug("AI context cleared");
  }
}
