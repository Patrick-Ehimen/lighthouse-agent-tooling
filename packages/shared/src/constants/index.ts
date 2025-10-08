/**
 * Shared constants for the Lighthouse AI integration system
 */

export * from "./api";
export * from "./errors";

// File size limits
export const FILE_SIZE_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_TOTAL_SIZE: 1024 * 1024 * 1024, // 1GB
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks for streaming
} as const;

// Supported file types
export const SUPPORTED_FILE_TYPES = {
  DOCUMENTS: [".pdf", ".doc", ".docx", ".txt", ".md", ".rtf"],
  IMAGES: [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp"],
  VIDEOS: [".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm"],
  AUDIO: [".mp3", ".wav", ".flac", ".aac", ".ogg"],
  ARCHIVES: [".zip", ".rar", ".7z", ".tar", ".gz"],
  CODE: [".js", ".ts", ".py", ".java", ".cpp", ".c", ".go", ".rs"],
  DATA: [".json", ".xml", ".csv", ".yaml", ".yml"],
} as const;

// Default configuration values
export const DEFAULT_CONFIG = {
  RETRY_ATTEMPTS: 3,
  TIMEOUT_MS: 30000,
  BATCH_SIZE: 10,
  CONCURRENT_UPLOADS: 3,
  LOG_LEVEL: "info",
  CACHE_TTL: 3600, // 1 hour in seconds
} as const;

// Encryption settings
export const ENCRYPTION_CONFIG = {
  ALGORITHM: "aes-256-gcm",
  KEY_LENGTH: 32,
  IV_LENGTH: 16,
  TAG_LENGTH: 16,
  SALT_LENGTH: 32,
} as const;

// Progress tracking constants
export const PROGRESS_STAGES = {
  INITIALIZING: "initializing",
  VALIDATING: "validating",
  UPLOADING: "uploading",
  ENCRYPTING: "encrypting",
  PROCESSING: "processing",
  FINALIZING: "finalizing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
