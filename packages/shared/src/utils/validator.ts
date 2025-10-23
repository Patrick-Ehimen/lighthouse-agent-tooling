/**
 * Validation utilities for input sanitization and data validation
 */

import * as path from "path";
import { SUPPORTED_FILE_TYPES, FILE_SIZE_LIMITS } from "../constants";
import { ErrorFactory } from "./error-handler";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: any;
}

export class Validator {
  /**
   * Validate and sanitize file path
   */
  static validateFilePath(filePath: string): ValidationResult {
    if (!filePath || typeof filePath !== "string") {
      return {
        isValid: false,
        error: "File path must be a non-empty string",
      };
    }

    // Remove null bytes and normalize path
    const sanitized = path.normalize(filePath.replace(/\0/g, ""));

    // Check for path traversal attempts
    if (sanitized.includes("..") || sanitized.startsWith("/")) {
      return {
        isValid: false,
        error: "Path traversal detected in file path",
      };
    }

    // Check for invalid characters (Windows and Unix)
    const invalidChars = /[<>:"|?*\x00-\x1f]/;
    if (invalidChars.test(sanitized)) {
      return {
        isValid: false,
        error: "File path contains invalid characters",
      };
    }

    return {
      isValid: true,
      sanitized,
    };
  }

  /**
   * Validate CID (Content Identifier) format
   */
  static validateCID(cid: string): ValidationResult {
    if (!cid || typeof cid !== "string") {
      return {
        isValid: false,
        error: "CID must be a non-empty string",
      };
    }

    // Basic CID format validation (simplified)
    // CIDv0: starts with Qm, 46 characters, base58
    // CIDv1: starts with b, variable length, base32
    const cidv0Pattern = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
    const cidv1Pattern = /^b[a-z2-7]+$/;

    const sanitized = cid.trim();

    if (!cidv0Pattern.test(sanitized) && !cidv1Pattern.test(sanitized)) {
      return {
        isValid: false,
        error: "Invalid CID format",
      };
    }

    return {
      isValid: true,
      sanitized,
    };
  }

  /**
   * Validate file type against supported types
   */
  static validateFileType(fileName: string): ValidationResult {
    if (!fileName || typeof fileName !== "string") {
      return {
        isValid: false,
        error: "File name must be a non-empty string",
      };
    }

    const extension = path.extname(fileName.toLowerCase());
    const allSupportedTypes = Object.values(SUPPORTED_FILE_TYPES).flat();

    if (!allSupportedTypes.includes(extension as any)) {
      return {
        isValid: false,
        error: `Unsupported file type: ${extension}`,
      };
    }

    return {
      isValid: true,
      sanitized: fileName.trim(),
    };
  }

  /**
   * Validate file size
   */
  static validateFileSize(size: number): ValidationResult {
    if (typeof size !== "number" || size < 0) {
      return {
        isValid: false,
        error: "File size must be a non-negative number",
      };
    }

    if (size > FILE_SIZE_LIMITS.MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File size exceeds maximum limit of ${FILE_SIZE_LIMITS.MAX_FILE_SIZE} bytes`,
      };
    }

    return {
      isValid: true,
      sanitized: size,
    };
  }

  /**
   * Validate API key format
   */
  static validateApiKey(apiKey: string): ValidationResult {
    if (!apiKey || typeof apiKey !== "string") {
      return {
        isValid: false,
        error: "API key must be a non-empty string",
      };
    }

    const sanitized = apiKey.trim();

    // Basic API key validation (adjust pattern as needed)
    if (sanitized.length < 32) {
      return {
        isValid: false,
        error: "API key is too short",
      };
    }

    // Check for valid characters (alphanumeric and some special chars)
    const validPattern = /^[A-Za-z0-9._-]+$/;
    if (!validPattern.test(sanitized)) {
      return {
        isValid: false,
        error: "API key contains invalid characters",
      };
    }

    return {
      isValid: true,
      sanitized,
    };
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): ValidationResult {
    if (!email || typeof email !== "string") {
      return {
        isValid: false,
        error: "Email must be a non-empty string",
      };
    }

    const sanitized = email.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(sanitized)) {
      return {
        isValid: false,
        error: "Invalid email format",
      };
    }

    return {
      isValid: true,
      sanitized,
    };
  }

  /**
   * Sanitize input by removing potentially dangerous content
   */
  static sanitizeInput(input: any): any {
    if (typeof input === "string") {
      return input
        .replace(/\0/g, "") // Remove null bytes
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove script tags
        .replace(/javascript:/gi, "") // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, "") // Remove event handlers
        .trim();
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.sanitizeInput(item));
    }

    if (input && typeof input === "object") {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[this.sanitizeInput(key)] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input;
  }

  /**
   * Validate required fields in an object
   */
  static validateRequiredFields(
    obj: Record<string, any>,
    requiredFields: string[],
  ): ValidationResult {
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (!(field in obj) || obj[field] === null || obj[field] === undefined) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return {
        isValid: false,
        error: `Missing required fields: ${missingFields.join(", ")}`,
      };
    }

    return {
      isValid: true,
      sanitized: obj,
    };
  }

  /**
   * Validate and throw error if validation fails
   */
  static validateOrThrow(
    value: any,
    validator: (value: any) => ValidationResult,
    context?: Record<string, any>,
  ): any {
    const result = validator(value);
    if (!result.isValid) {
      throw ErrorFactory.validation("validation", value, {
        error: result.error,
        ...context,
      });
    }
    return result.sanitized;
  }
}
