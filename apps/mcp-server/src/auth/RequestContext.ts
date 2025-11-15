/**
 * Request context for API key and service isolation
 */

import crypto from "crypto";
import { ILighthouseService } from "../services/ILighthouseService.js";
import { RequestContextParams, LogContext } from "./types.js";

export class RequestContext {
  public readonly apiKey: string;
  public readonly keyHash: string;
  public readonly service: ILighthouseService;
  public readonly toolName: string;
  public readonly requestId: string;
  public readonly timestamp: Date;

  constructor(params: RequestContextParams) {
    this.apiKey = params.apiKey;
    this.keyHash = params.keyHash;
    this.service = params.service;
    this.toolName = params.toolName;
    this.requestId = crypto.randomUUID();
    this.timestamp = new Date();
  }

  /**
   * Get sanitized context for logging (without sensitive data)
   */
  toLogContext(): LogContext {
    return {
      requestId: this.requestId,
      keyHash: this.keyHash,
      toolName: this.toolName,
      timestamp: this.timestamp.toISOString(),
    };
  }

  /**
   * Get request age in milliseconds
   */
  getAge(): number {
    return Date.now() - this.timestamp.getTime();
  }

  /**
   * Check if request has expired
   */
  isExpired(timeoutMs: number): boolean {
    return this.getAge() > timeoutMs;
  }
}
