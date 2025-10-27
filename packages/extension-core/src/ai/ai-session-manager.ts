/**
 * AI session manager implementation
 * @fileoverview Manages AI sessions and interactions
 */

import type { AISession } from "@lighthouse-tooling/types";
import { Logger } from "@lighthouse-tooling/shared";

/**
 * AI session manager implementation
 */
export class AISessionManagerImpl {
  private _activeSessions = new Map<string, AISession>();
  private _logger: Logger;

  constructor() {
    this._logger = new Logger({ level: "info", component: "AISessionManager" });
  }

  /**
   * Create a new AI session
   */
  createSession(agentId: string, context?: Record<string, unknown>): AISession {
    const sessionId = `${agentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const session: AISession = {
      sessionId,
      startTime: new Date(),
      lastActivity: new Date(),
      duration: 0,
      interactionCount: 0,
      context: context || {},
    };

    this._activeSessions.set(sessionId, session);
    this._logger.debug(`Created AI session: ${sessionId} for agent: ${agentId}`);

    return session;
  }

  /**
   * Get an active session
   */
  getSession(sessionId: string): AISession | undefined {
    return this._activeSessions.get(sessionId);
  }

  /**
   * Update session activity
   */
  updateSessionActivity(sessionId: string): void {
    const session = this._activeSessions.get(sessionId);
    if (!session) {
      this._logger.warn(`Session not found: ${sessionId}`);
      return;
    }

    const now = new Date();
    session.lastActivity = now;
    session.duration = now.getTime() - session.startTime.getTime();
    session.interactionCount += 1;

    this._logger.debug(`Updated session activity: ${sessionId}`);
  }

  /**
   * End a session
   */
  endSession(sessionId: string): void {
    const session = this._activeSessions.get(sessionId);
    if (!session) {
      this._logger.warn(`Session not found: ${sessionId}`);
      return;
    }

    this._activeSessions.delete(sessionId);
    this._logger.debug(`Ended AI session: ${sessionId}`);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): AISession[] {
    return Array.from(this._activeSessions.values());
  }

  /**
   * Clean up old sessions
   */
  cleanupOldSessions(maxAge: number = 3600000): void {
    // 1 hour default
    const now = Date.now();
    const sessionsToRemove: string[] = [];

    for (const [sessionId, session] of this._activeSessions) {
      if (now - session.lastActivity.getTime() > maxAge) {
        sessionsToRemove.push(sessionId);
      }
    }

    for (const sessionId of sessionsToRemove) {
      this._activeSessions.delete(sessionId);
    }

    if (sessionsToRemove.length > 0) {
      this._logger.debug(`Cleaned up ${sessionsToRemove.length} old sessions`);
    }
  }
}
