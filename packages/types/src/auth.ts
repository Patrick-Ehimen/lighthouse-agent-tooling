/**
 * Authentication and authorization types for Lighthouse AI integration
 * @fileoverview Defines types for authentication, tokens, and API credentials
 */

/**
 * Authentication configuration for Lighthouse services
 */
export interface AuthConfig {
  /** API key for Lighthouse services */
  apiKey?: string;
  /** Wallet private key for encryption operations */
  privateKey?: string;
  /** Wallet address for authentication */
  address?: string;
  /** Authentication token */
  token?: string;
  /** Token refresh configuration */
  refreshConfig?: TokenRefreshConfig;
  /** Authentication method */
  method: AuthMethod;
  /** Additional authentication parameters */
  parameters?: Record<string, unknown>;
}

/**
 * Methods of authentication supported
 */
export enum AuthMethod {
  /** API key authentication */
  API_KEY = 'api_key',
  /** Wallet-based authentication */
  WALLET = 'wallet',
  /** JWT token authentication */
  JWT = 'jwt',
  /** OAuth authentication */
  OAUTH = 'oauth',
  /** Custom authentication */
  CUSTOM = 'custom'
}

/**
 * Token information and metadata
 */
export interface TokenInfo {
  /** The actual token value */
  token: string;
  /** Token type (Bearer, Basic, etc.) */
  type: TokenType;
  /** Token expiration timestamp */
  expiresAt?: Date;
  /** Token scope/permissions */
  scope?: string[];
  /** Token issuer */
  issuer?: string;
  /** Token subject (user/entity) */
  subject?: string;
  /** Whether the token is valid */
  isValid: boolean;
  /** Time when the token was issued */
  issuedAt?: Date;
  /** Token refresh token (if applicable) */
  refreshToken?: string;
}

/**
 * Types of authentication tokens
 */
export enum TokenType {
  /** Bearer token */
  BEARER = 'Bearer',
  /** Basic authentication */
  BASIC = 'Basic',
  /** API key */
  API_KEY = 'ApiKey',
  /** Custom token type */
  CUSTOM = 'Custom'
}

/**
 * Token refresh configuration
 */
export interface TokenRefreshConfig {
  /** Whether automatic refresh is enabled */
  enabled: boolean;
  /** Time before expiration to refresh (in milliseconds) */
  refreshThreshold: number;
  /** Maximum number of refresh attempts */
  maxRetries: number;
  /** Refresh token endpoint */
  refreshEndpoint?: string;
  /** Custom refresh logic */
  customRefresh?: () => Promise<TokenInfo>;
}

/**
 * API credentials for external services
 */
export interface APICredentials {
  /** Service name or identifier */
  service: string;
  /** API key or token */
  apiKey: string;
  /** Secret key (if required) */
  secretKey?: string;
  /** Base URL for the API */
  baseUrl?: string;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Authentication method */
  authMethod: APIAuthMethod;
  /** Credential expiration */
  expiresAt?: Date;
  /** Whether credentials are encrypted */
  encrypted: boolean;
}

/**
 * API authentication methods
 */
export enum APIAuthMethod {
  /** API key in header */
  API_KEY_HEADER = 'api_key_header',
  /** API key in query parameter */
  API_KEY_QUERY = 'api_key_query',
  /** Bearer token */
  BEARER_TOKEN = 'bearer_token',
  /** Basic authentication */
  BASIC_AUTH = 'basic_auth',
  /** OAuth 2.0 */
  OAUTH2 = 'oauth2',
  /** Custom authentication */
  CUSTOM = 'custom'
}

/**
 * User authentication context
 */
export interface AuthContext {
  /** User identifier */
  userId: string;
  /** User email */
  email?: string;
  /** User roles */
  roles: string[];
  /** User permissions */
  permissions: Permission[];
  /** Authentication method used */
  authMethod: AuthMethod;
  /** Session information */
  session: SessionInfo;
  /** User preferences */
  preferences?: UserPreferences;
}

/**
 * User session information
 */
export interface SessionInfo {
  /** Session identifier */
  sessionId: string;
  /** Session creation time */
  createdAt: Date;
  /** Last activity time */
  lastActivity: Date;
  /** Session expiration time */
  expiresAt?: Date;
  /** IP address of the session */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Whether session is active */
  isActive: boolean;
}

/**
 * User permissions
 */
export interface Permission {
  /** Permission identifier */
  id: string;
  /** Permission name */
  name: string;
  /** Permission description */
  description?: string;
  /** Resource the permission applies to */
  resource: string;
  /** Actions allowed by this permission */
  actions: string[];
  /** Permission conditions */
  conditions?: PermissionCondition[];
}

/**
 * Conditions for permission evaluation
 */
export interface PermissionCondition {
  /** Condition type */
  type: ConditionType;
  /** Condition value */
  value: string;
  /** Condition operator */
  operator: ConditionOperator;
}

/**
 * Types of permission conditions
 */
export enum ConditionType {
  /** Time-based condition */
  TIME = 'time',
  /** IP address condition */
  IP_ADDRESS = 'ip_address',
  /** Resource condition */
  RESOURCE = 'resource',
  /** Custom condition */
  CUSTOM = 'custom'
}

/**
 * Condition operators
 */
export enum ConditionOperator {
  /** Equals */
  EQUALS = 'equals',
  /** Not equals */
  NOT_EQUALS = 'not_equals',
  /** Greater than */
  GREATER_THAN = 'greater_than',
  /** Less than */
  LESS_THAN = 'less_than',
  /** Contains */
  CONTAINS = 'contains',
  /** Starts with */
  STARTS_WITH = 'starts_with',
  /** Ends with */
  ENDS_WITH = 'ends_with',
  /** In list */
  IN = 'in',
  /** Not in list */
  NOT_IN = 'not_in'
}

/**
 * User preferences for authentication
 */
export interface UserPreferences {
  /** Preferred authentication method */
  preferredAuthMethod?: AuthMethod;
  /** Auto-login enabled */
  autoLogin?: boolean;
  /** Session timeout preference */
  sessionTimeout?: number;
  /** Two-factor authentication enabled */
  twoFactorEnabled?: boolean;
  /** Notification preferences */
  notifications?: NotificationPreferences;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  /** Email notifications enabled */
  email: boolean;
  /** Push notifications enabled */
  push: boolean;
  /** SMS notifications enabled */
  sms: boolean;
  /** Notification types */
  types: NotificationType[];
}

/**
 * Types of notifications
 */
export enum NotificationType {
  /** Authentication events */
  AUTH = 'auth',
  /** Security alerts */
  SECURITY = 'security',
  /** System updates */
  SYSTEM = 'system',
  /** Usage alerts */
  USAGE = 'usage'
}

/**
 * Authentication result
 */
export interface AuthResult {
  /** Whether authentication was successful */
  success: boolean;
  /** Authentication context (if successful) */
  context?: AuthContext;
  /** Error message (if failed) */
  error?: string;
  /** Error code (if failed) */
  errorCode?: AuthErrorCode;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Authentication error codes
 */
export enum AuthErrorCode {
  /** Invalid credentials */
  INVALID_CREDENTIALS = 'invalid_credentials',
  /** Token expired */
  TOKEN_EXPIRED = 'token_expired',
  /** Insufficient permissions */
  INSUFFICIENT_PERMISSIONS = 'insufficient_permissions',
  /** Account locked */
  ACCOUNT_LOCKED = 'account_locked',
  /** Two-factor required */
  TWO_FACTOR_REQUIRED = 'two_factor_required',
  /** Rate limit exceeded */
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  /** Network error */
  NETWORK_ERROR = 'network_error',
  /** Unknown error */
  UNKNOWN_ERROR = 'unknown_error'
}
