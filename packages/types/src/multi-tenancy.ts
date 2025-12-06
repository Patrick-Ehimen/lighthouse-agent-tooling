/**
 * Multi-Tenancy Types and Models
 * Defines the structure for organizations, teams, roles, and permissions
 */

/**
 * Role types for RBAC
 */
export enum Role {
  /** Full access to organization and all teams */
  OWNER = "owner",
  /** Administrative access within a team */
  ADMIN = "admin",
  /** Regular member with standard access */
  MEMBER = "member",
  /** Read-only access */
  VIEWER = "viewer",
}

/**
 * Permission types for fine-grained access control
 */
export enum Permission {
  // File Operations
  FILE_UPLOAD = "file:upload",
  FILE_DOWNLOAD = "file:download",
  FILE_DELETE = "file:delete",
  FILE_LIST = "file:list",
  FILE_SHARE = "file:share",

  // Dataset Operations
  DATASET_CREATE = "dataset:create",
  DATASET_READ = "dataset:read",
  DATASET_UPDATE = "dataset:update",
  DATASET_DELETE = "dataset:delete",
  DATASET_LIST = "dataset:list",

  // Team Management
  TEAM_CREATE = "team:create",
  TEAM_READ = "team:read",
  TEAM_UPDATE = "team:update",
  TEAM_DELETE = "team:delete",
  TEAM_MANAGE_MEMBERS = "team:manage_members",

  // API Key Management
  API_KEY_CREATE = "api_key:create",
  API_KEY_READ = "api_key:read",
  API_KEY_REVOKE = "api_key:revoke",
  API_KEY_LIST = "api_key:list",

  // Organization Management
  ORG_UPDATE = "org:update",
  ORG_DELETE = "org:delete",
  ORG_MANAGE_BILLING = "org:manage_billing",
  ORG_VIEW_USAGE = "org:view_usage",

  // Quota Management
  QUOTA_VIEW = "quota:view",
  QUOTA_UPDATE = "quota:update",
}

/**
 * Role to Permission mapping
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.OWNER]: [
    // Owners have all permissions
    ...Object.values(Permission),
  ],
  [Role.ADMIN]: [
    // File operations
    Permission.FILE_UPLOAD,
    Permission.FILE_DOWNLOAD,
    Permission.FILE_DELETE,
    Permission.FILE_LIST,
    Permission.FILE_SHARE,
    // Dataset operations
    Permission.DATASET_CREATE,
    Permission.DATASET_READ,
    Permission.DATASET_UPDATE,
    Permission.DATASET_DELETE,
    Permission.DATASET_LIST,
    // Team management (limited)
    Permission.TEAM_READ,
    Permission.TEAM_UPDATE,
    Permission.TEAM_MANAGE_MEMBERS,
    // API keys
    Permission.API_KEY_CREATE,
    Permission.API_KEY_READ,
    Permission.API_KEY_REVOKE,
    Permission.API_KEY_LIST,
    // Usage
    Permission.ORG_VIEW_USAGE,
    Permission.QUOTA_VIEW,
  ],
  [Role.MEMBER]: [
    // File operations
    Permission.FILE_UPLOAD,
    Permission.FILE_DOWNLOAD,
    Permission.FILE_LIST,
    // Dataset operations
    Permission.DATASET_CREATE,
    Permission.DATASET_READ,
    Permission.DATASET_UPDATE,
    Permission.DATASET_LIST,
    // Limited team access
    Permission.TEAM_READ,
    // API keys (own only)
    Permission.API_KEY_READ,
    Permission.API_KEY_LIST,
    // Usage
    Permission.QUOTA_VIEW,
  ],
  [Role.VIEWER]: [
    // Read-only access
    Permission.FILE_DOWNLOAD,
    Permission.FILE_LIST,
    Permission.DATASET_READ,
    Permission.DATASET_LIST,
    Permission.TEAM_READ,
    Permission.QUOTA_VIEW,
  ],
};

/**
 * Organization entity - top-level tenant
 */
export interface Organization {
  /** Unique organization identifier */
  id: string;
  /** Organization name */
  name: string;
  /** Organization display name */
  displayName: string;
  /** Organization description */
  description?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Organization owner user ID */
  ownerId: string;
  /** Organization settings */
  settings: OrganizationSettings;
  /** Organization status */
  status: "active" | "suspended" | "deleted";
  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Organization settings
 */
export interface OrganizationSettings {
  /** Default storage quota in bytes */
  defaultStorageQuota: number;
  /** Default API rate limit (requests per minute) */
  defaultRateLimit: number;
  /** Allow team creation */
  allowTeamCreation: boolean;
  /** Require 2FA for all members */
  require2FA: boolean;
  /** Data retention policy in days (0 = infinite) */
  dataRetentionDays: number;
  /** Allowed file types (empty = all allowed) */
  allowedFileTypes: string[];
  /** Maximum file size in bytes */
  maxFileSize: number;
  /** Enable audit logging */
  enableAuditLog: boolean;
  /** Custom domain for organization */
  customDomain?: string;
}

/**
 * Team entity - sub-group within organization
 */
export interface Team {
  /** Unique team identifier */
  id: string;
  /** Parent organization ID */
  organizationId: string;
  /** Team name */
  name: string;
  /** Team display name */
  displayName: string;
  /** Team description */
  description?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Team owner user ID */
  ownerId: string;
  /** Team members */
  members: TeamMember[];
  /** Team-specific quota overrides */
  quotaOverrides?: Partial<UsageQuota>;
  /** Team status */
  status: "active" | "suspended" | "deleted";
  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Team member with role assignment
 */
export interface TeamMember {
  /** User identifier */
  userId: string;
  /** User email */
  email: string;
  /** User display name */
  displayName: string;
  /** Member role in this team */
  role: Role;
  /** When the user joined the team */
  joinedAt: string;
  /** Last activity timestamp */
  lastActiveAt?: string;
  /** Member status */
  status: "active" | "invited" | "suspended";
}

/**
 * API Key with tenant context
 */
export interface TenantApiKey {
  /** Unique key identifier */
  id: string;
  /** Organization ID this key belongs to */
  organizationId: string;
  /** Team ID this key belongs to (optional) */
  teamId?: string;
  /** User ID who created the key */
  createdBy: string;
  /** Key name/description */
  name: string;
  /** The actual API key (format: org_{orgId}_team_{teamId}_key_{keyId}.{secret}) */
  key: string;
  /** Hashed version of the key for lookups */
  keyHash: string;
  /** Key creation timestamp */
  createdAt: string;
  /** Key expiration timestamp (optional) */
  expiresAt?: string;
  /** Last used timestamp */
  lastUsedAt?: string;
  /** Key status */
  status: "active" | "revoked" | "expired";
  /** Scoped permissions (overrides role permissions if set) */
  permissions?: Permission[];
  /** Usage statistics */
  usageStats?: ApiKeyUsageStats;
  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * API Key usage statistics
 */
export interface ApiKeyUsageStats {
  /** Total requests made with this key */
  totalRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Last request timestamp */
  lastRequestAt?: string;
  /** Rate limit hits */
  rateLimitHits: number;
  /** Total bytes uploaded */
  bytesUploaded: number;
  /** Total bytes downloaded */
  bytesDownloaded: number;
}

/**
 * Usage quota limits
 */
export interface UsageQuota {
  /** Storage limit in bytes */
  storageLimit: number;
  /** Current storage used in bytes */
  storageUsed: number;
  /** API request limit per month */
  requestLimit: number;
  /** Current requests this month */
  requestsUsed: number;
  /** Bandwidth limit in bytes per month */
  bandwidthLimit: number;
  /** Current bandwidth used this month in bytes */
  bandwidthUsed: number;
  /** Maximum number of teams allowed */
  maxTeams: number;
  /** Current number of teams */
  currentTeams: number;
  /** Maximum number of members per team */
  maxMembersPerTeam: number;
  /** Maximum number of API keys */
  maxApiKeys: number;
  /** Current number of API keys */
  currentApiKeys: number;
  /** Reset date for monthly quotas */
  resetDate: string;
}

/**
 * Tenant context for request processing
 */
export interface TenantContext {
  /** Organization */
  organization: Organization;
  /** Team (if request is team-scoped) */
  team?: Team;
  /** User making the request */
  user: TeamMember;
  /** API key used for the request */
  apiKey: TenantApiKey;
  /** Effective permissions for this context */
  permissions: Permission[];
  /** Current usage quota */
  quota: UsageQuota;
}

/**
 * Tenant resolution result
 */
export interface TenantResolutionResult {
  /** Whether resolution was successful */
  success: boolean;
  /** Resolved tenant context */
  context?: TenantContext;
  /** Error message if resolution failed */
  error?: string;
  /** Error code */
  errorCode?: TenantErrorCode;
}

/**
 * Tenant-specific error codes
 */
export enum TenantErrorCode {
  ORGANIZATION_NOT_FOUND = "ORGANIZATION_NOT_FOUND",
  TEAM_NOT_FOUND = "TEAM_NOT_FOUND",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  API_KEY_NOT_FOUND = "API_KEY_NOT_FOUND",
  API_KEY_EXPIRED = "API_KEY_EXPIRED",
  API_KEY_REVOKED = "API_KEY_REVOKED",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  ORGANIZATION_SUSPENDED = "ORGANIZATION_SUSPENDED",
  TEAM_SUSPENDED = "TEAM_SUSPENDED",
  USER_SUSPENDED = "USER_SUSPENDED",
  INVALID_KEY_FORMAT = "INVALID_KEY_FORMAT",
}

/**
 * Audit log entry for tenant operations
 */
export interface TenantAuditLog {
  /** Unique log entry ID */
  id: string;
  /** Organization ID */
  organizationId: string;
  /** Team ID (optional) */
  teamId?: string;
  /** User who performed the action */
  userId: string;
  /** Action performed */
  action: string;
  /** Resource affected */
  resource: string;
  /** Resource ID */
  resourceId: string;
  /** Timestamp */
  timestamp: string;
  /** IP address */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
  /** Action result */
  result: "success" | "failure";
  /** Error message if failed */
  errorMessage?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Tenant storage configuration
 */
export interface TenantStorageConfig {
  /** Root directory for tenant data */
  rootPath: string;
  /** Organization-specific storage path */
  organizationPath: (orgId: string) => string;
  /** Team-specific storage path */
  teamPath: (orgId: string, teamId: string) => string;
  /** Enable storage encryption */
  enableEncryption: boolean;
  /** Storage backend type */
  backendType: "local" | "s3" | "ipfs";
}

/**
 * Multi-tenancy configuration
 */
export interface MultiTenancyConfig {
  /** Enable multi-tenancy features */
  enabled: boolean;
  /** Default organization for legacy single-tenant mode */
  defaultOrganizationId: string;
  /** Storage configuration */
  storage: TenantStorageConfig;
  /** Default organization settings */
  defaultOrganizationSettings: OrganizationSettings;
  /** Default usage quota */
  defaultQuota: UsageQuota;
  /** Enable strict tenant isolation */
  strictIsolation: boolean;
  /** Audit log retention days */
  auditLogRetentionDays: number;
}
