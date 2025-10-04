import { EventEmitter } from "eventemitter3";
import { AuthState, LighthouseConfig } from "../types";

/**
 * Manages JWT token authentication and automatic refresh for Lighthouse API
 */
export class AuthenticationManager extends EventEmitter {
  private authState: AuthState;
  private config: LighthouseConfig;
  private refreshTimer: NodeJS.Timeout | null = null;
  private refreshPromise: Promise<void> | null = null;

  constructor(config: LighthouseConfig) {
    super();
    this.config = config;
    this.authState = {
      accessToken: null,
      expiresAt: null,
      isAuthenticated: false,
      lastError: null,
    };
  }

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * Get current access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    if (!this.isTokenValid()) {
      await this.refreshToken();
    }

    if (!this.authState.accessToken) {
      throw new Error("Failed to obtain valid access token");
    }

    return this.authState.accessToken;
  }

  /**
   * Initialize authentication with API key
   */
  async authenticate(): Promise<void> {
    try {
      const response = await this.requestToken();
      this.updateAuthState(response);
      this.scheduleTokenRefresh();
      this.emit("auth:success", this.authState);
    } catch (error) {
      this.handleAuthError(error as Error);
      throw error;
    }
  }

  /**
   * Refresh the current token
   */
  async refreshToken(): Promise<void> {
    // Prevent multiple concurrent refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();

    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Clear authentication state and stop refresh timer
   */
  logout(): void {
    this.clearRefreshTimer();
    this.authState = {
      accessToken: null,
      expiresAt: null,
      isAuthenticated: false,
      lastError: null,
    };
    this.emit("auth:logout");
  }

  /**
   * Check if current token is valid and not expired
   */
  private isTokenValid(): boolean {
    if (!this.authState.accessToken || !this.authState.expiresAt) {
      return false;
    }

    // Add 5 minute buffer before expiration
    const bufferTime = 5 * 60 * 1000;
    return Date.now() < this.authState.expiresAt - bufferTime;
  }

  /**
   * Request new token from Lighthouse API
   */
  private async requestToken(): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    const response = await fetch(
      `${this.config.baseUrl || "https://node.lighthouse.storage"}/api/auth/get_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: this.config.apiKey,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Authentication failed: ${response.status} ${errorData.message || response.statusText}`
      );
    }

    const data = await response.json();

    if (!data.accessToken || !data.expiresIn) {
      throw new Error("Invalid authentication response format");
    }

    return {
      accessToken: data.accessToken,
      expiresIn: data.expiresIn,
    };
  }

  /**
   * Perform token refresh operation
   */
  private async performTokenRefresh(): Promise<void> {
    try {
      this.emit("auth:refresh:start");
      const response = await this.requestToken();
      this.updateAuthState(response);
      this.scheduleTokenRefresh();
      this.emit("auth:refresh:success", this.authState);
    } catch (error) {
      this.handleAuthError(error as Error);
      this.emit("auth:refresh:error", error);
      throw error;
    }
  }

  /**
   * Update internal auth state with new token data
   */
  private updateAuthState(tokenData: {
    accessToken: string;
    expiresIn: number;
  }): void {
    const expiresAt = Date.now() + tokenData.expiresIn * 1000;

    this.authState = {
      accessToken: tokenData.accessToken,
      expiresAt,
      isAuthenticated: true,
      lastError: null,
    };
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(): void {
    this.clearRefreshTimer();

    if (!this.authState.expiresAt) {
      return;
    }

    // Schedule refresh 10 minutes before expiration
    const refreshTime = this.authState.expiresAt - Date.now() - 10 * 60 * 1000;

    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshToken().catch((error) => {
          console.error("Automatic token refresh failed:", error);
        });
      }, refreshTime);
    }
  }

  /**
   * Clear the refresh timer
   */
  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: Error): void {
    this.authState.lastError = error.message;
    this.authState.isAuthenticated = false;
    this.clearRefreshTimer();
    this.emit("auth:error", error);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clearRefreshTimer();
    this.removeAllListeners();
  }
}
