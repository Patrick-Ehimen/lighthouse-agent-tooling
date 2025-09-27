/**
 * API endpoints and configuration constants for Lighthouse services
 */

export const API_ENDPOINTS = {
  LIGHTHOUSE_UPLOAD: "https://node.lighthouse.storage/api/v0/add",
  LIGHTHOUSE_STATUS: "https://api.lighthouse.storage/api/lighthouse/file_info",
  LIGHTHOUSE_DEALS: "https://api.lighthouse.storage/api/lighthouse/deals",
  LIGHTHOUSE_QUOTA: "https://api.lighthouse.storage/api/user/user_data_usage",
  KAVACH_ENCRYPT: "https://encryption.lighthouse.storage/api/v0/encrypt",
  KAVACH_DECRYPT: "https://encryption.lighthouse.storage/api/v0/decrypt",
  KAVACH_CONDITIONS: "https://encryption.lighthouse.storage/api/v0/conditions",
} as const;

export const API_TIMEOUTS = {
  DEFAULT: 30000, // 30 seconds
  UPLOAD: 300000, // 5 minutes for file uploads
  ENCRYPTION: 120000, // 2 minutes for encryption operations
  STATUS_CHECK: 10000, // 10 seconds for status checks
} as const;

export const API_RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000, // 1 second
  MAX_DELAY: 10000, // 10 seconds
  BACKOFF_MULTIPLIER: 2,
} as const;

export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;
