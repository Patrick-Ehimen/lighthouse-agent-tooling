import { promises as fs } from "fs";
import { FileInfo } from "../types";

/**
 * Generate a unique operation ID
 */
export function generateOperationId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate that a file exists and return its stats
 */
export async function validateFile(
  filePath: string
): Promise<{ size: number; mtime: Date }> {
  try {
    const stats = await fs.stat(filePath);

    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }

    return {
      size: stats.size,
      mtime: stats.mtime,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    throw error;
  }
}

/**
 * Create a FileInfo object from raw data
 */
export function createFileInfo(data: {
  hash: string;
  name: string;
  size: number;
  mimeType: string;
  metadata?: Record<string, any>;
  encrypted: boolean;
}): FileInfo {
  return {
    hash: data.hash,
    name: data.name,
    size: data.size,
    mimeType: data.mimeType,
    uploadedAt: new Date(),
    metadata: data.metadata,
    encrypted: data.encrypted,
  };
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop();

  const mimeTypes: Record<string, string> = {
    txt: "text/plain",
    json: "application/json",
    js: "application/javascript",
    ts: "application/typescript",
    html: "text/html",
    css: "text/css",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    pdf: "application/pdf",
    zip: "application/zip",
    csv: "text/csv",
    xml: "application/xml",
  };

  return mimeTypes[ext || ""] || "application/octet-stream";
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Format duration in seconds to human readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const retryableMessages = [
    "network",
    "timeout",
    "connection",
    "temporary",
    "rate limit",
    "too many requests",
  ];

  const message = error.message.toLowerCase();
  return retryableMessages.some((keyword) => message.includes(keyword));
}
