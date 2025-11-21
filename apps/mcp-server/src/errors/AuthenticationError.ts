/**
 * Authentication-specific error handling
 */

import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

export enum AuthErrorType {
  MISSING_API_KEY = "MISSING_API_KEY",
  INVALID_API_KEY = "INVALID_API_KEY",
  EXPIRED_API_KEY = "EXPIRED_API_KEY",
  RATE_LIMITED = "RATE_LIMITED",
  VALIDATION_FAILED = "VALIDATION_FAILED",
}

export class AuthenticationError extends McpError {
  public readonly type: AuthErrorType;
  public readonly keyHash?: string;
  public readonly retryAfter?: number;

  constructor(type: AuthErrorType, message: string, keyHash?: string, retryAfter?: number) {
    super(ErrorCode.InvalidRequest, message);
    this.name = "AuthenticationError";
    this.type = type;
    this.keyHash = keyHash;
    this.retryAfter = retryAfter;
  }

  static missingApiKey(): AuthenticationError {
    return new AuthenticationError(
      AuthErrorType.MISSING_API_KEY,
      "API key is required. Provide apiKey parameter or configure server default.",
    );
  }

  static invalidApiKey(keyHash: string): AuthenticationError {
    return new AuthenticationError(
      AuthErrorType.INVALID_API_KEY,
      "Invalid API key provided. Please check your credentials.",
      keyHash,
    );
  }

  static expiredApiKey(keyHash: string): AuthenticationError {
    return new AuthenticationError(
      AuthErrorType.EXPIRED_API_KEY,
      "API key has expired. Please obtain a new key.",
      keyHash,
    );
  }

  static rateLimited(keyHash: string, retryAfter: number): AuthenticationError {
    return new AuthenticationError(
      AuthErrorType.RATE_LIMITED,
      `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      keyHash,
      retryAfter,
    );
  }

  static validationFailed(keyHash: string, reason?: string): AuthenticationError {
    const message = reason
      ? `API key validation failed: ${reason}`
      : "API key validation failed. Please check your credentials.";

    return new AuthenticationError(AuthErrorType.VALIDATION_FAILED, message, keyHash);
  }

  /**
   * Convert to MCP error response format
   */
  toMcpError(): {
    error: {
      code: number;
      message: string;
      type: AuthErrorType;
      keyHash?: string;
      retryAfter?: number;
      documentation?: string;
    };
  } {
    return {
      error: {
        code: this.code,
        message: this.message,
        type: this.type,
        keyHash: this.keyHash,
        retryAfter: this.retryAfter,
        documentation: "https://docs.lighthouse.storage/mcp-server#authentication",
      },
    };
  }
}
