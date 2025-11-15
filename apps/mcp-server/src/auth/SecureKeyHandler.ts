/**
 * Secure API key handling utilities
 */

import crypto from "crypto";

export class SecureKeyHandler {
  /**
   * Hash API key for logging and caching
   */
  static hashKey(apiKey: string): string {
    return crypto.createHash("sha256").update(apiKey).digest("hex").substring(0, 16);
  }

  /**
   * Sanitize API key for logs (show only first/last chars)
   */
  static sanitizeForLogs(apiKey: string): string {
    if (!apiKey || apiKey.length < 8) return "[REDACTED]";
    return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
  }

  /**
   * Secure comparison to prevent timing attacks
   */
  static secureCompare(a: string, b: string): boolean {
    if (!a || !b || a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  }

  /**
   * Clear sensitive data from memory
   */
  static clearFromMemory(obj: any, keys: string[]): void {
    keys.forEach((key) => {
      if (obj[key]) {
        obj[key] = null;
        delete obj[key];
      }
    });
  }

  /**
   * Validate API key format
   */
  static isValidFormat(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== "string") {
      return false;
    }
    // Basic validation: non-empty string with reasonable length
    return apiKey.length >= 10 && apiKey.length <= 256;
  }
}
