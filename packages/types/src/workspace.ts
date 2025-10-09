/**
 * Workspace context types for Lighthouse AI integration
 * @fileoverview Defines types for workspace context, project files, and Git information
 */

/**
 * Workspace context information
 */
export interface WorkspaceContext {
  /** Root path of the workspace */
  projectPath: string;
  /** Git information for the workspace */
  gitInfo?: GitInfo;
  /** List of Lighthouse files in the workspace */
  lighthouseFiles: ProjectFile[];
  /** Active datasets in the workspace */
  activeDatasets: DatasetReference[];
  /** Workspace metadata */
  metadata: WorkspaceMetadata;
  /** AI agent context */
  aiContext?: AIContext;
  /** Workspace configuration */
  configuration: WorkspaceConfiguration;
}

/**
 * Git information for the workspace
 */
export interface GitInfo {
  /** Current branch name */
  branch: string;
  /** Current commit hash */
  commit: string;
  /** Commit message */
  commitMessage?: string;
  /** Author of the current commit */
  author?: string;
  /** Commit timestamp */
  commitDate?: Date;
  /** Remote repository URL */
  remoteUrl?: string;
  /** Whether the working directory is clean */
  isClean: boolean;
  /** List of modified files */
  modifiedFiles: string[];
  /** List of staged files */
  stagedFiles: string[];
  /** List of untracked files */
  untrackedFiles: string[];
  /** Git tags */
  tags: string[];
  /** Recent commits */
  recentCommits: CommitInfo[];
}

/**
 * Information about a Git commit
 */
export interface CommitInfo {
  /** Commit hash */
  hash: string;
  /** Commit message */
  message: string;
  /** Author name */
  author: string;
  /** Author email */
  email: string;
  /** Commit date */
  date: Date;
  /** Files changed in this commit */
  filesChanged: string[];
}

/**
 * Project file information
 */
export interface ProjectFile {
  /** File path relative to workspace root */
  path: string;
  /** Absolute file path */
  absolutePath: string;
  /** File name */
  name: string;
  /** File extension */
  extension: string;
  /** File size in bytes */
  size: number;
  /** File modification time */
  modifiedAt: Date;
  /** File creation time */
  createdAt: Date;
  /** File hash (for integrity checking) */
  hash?: string;
  /** MIME type of the file */
  mimeType?: string;
  /** Whether the file is binary */
  isBinary: boolean;
  /** File permissions */
  permissions?: FilePermissions;
  /** Lighthouse-specific metadata */
  lighthouseMetadata?: LighthouseFileMetadata;
}

/**
 * File permissions information
 */
export interface FilePermissions {
  /** Read permission */
  readable: boolean;
  /** Write permission */
  writable: boolean;
  /** Execute permission */
  executable: boolean;
  /** Owner permissions */
  owner: PermissionBits;
  /** Group permissions */
  group: PermissionBits;
  /** Other permissions */
  other: PermissionBits;
}

/**
 * File permission bits
 */
export interface PermissionBits {
  /** Read permission */
  read: boolean;
  /** Write permission */
  write: boolean;
  /** Execute permission */
  execute: boolean;
}

/**
 * Lighthouse-specific file metadata
 */
export interface LighthouseFileMetadata {
  /** IPFS CID of the file */
  cid?: string;
  /** Whether the file is pinned */
  pinned: boolean;
  /** Whether the file is encrypted */
  encrypted: boolean;
  /** Access conditions for the file */
  accessConditions?: string[];
  /** Tags associated with the file */
  tags?: string[];
  /** Upload timestamp */
  uploadedAt?: Date;
  /** Last sync timestamp */
  lastSyncedAt?: Date;
  /** File version */
  version?: string;
}

/**
 * Reference to a dataset in the workspace
 */
export interface DatasetReference {
  /** Dataset identifier */
  id: string;
  /** Dataset name */
  name: string;
  /** Dataset description */
  description?: string;
  /** Local path to dataset files */
  localPath: string;
  /** Number of files in the dataset */
  fileCount: number;
  /** Total size of the dataset */
  totalSize: number;
  /** Dataset version */
  version: string;
  /** Whether the dataset is encrypted */
  encrypted: boolean;
  /** Dataset tags */
  tags: string[];
  /** Last modified time */
  lastModified: Date;
  /** Dataset status */
  status: DatasetStatus;
}

/**
 * Dataset status enumeration
 */
export enum DatasetStatus {
  /** Dataset is active and synced */
  ACTIVE = "active",
  /** Dataset is being uploaded */
  UPLOADING = "uploading",
  /** Dataset is being downloaded */
  DOWNLOADING = "downloading",
  /** Dataset is out of sync */
  OUT_OF_SYNC = "out_of_sync",
  /** Dataset is archived */
  ARCHIVED = "archived",
  /** Dataset has errors */
  ERROR = "error",
}

/**
 * Workspace metadata
 */
export interface WorkspaceMetadata {
  /** Workspace name */
  name: string;
  /** Workspace description */
  description?: string;
  /** Workspace type */
  type: WorkspaceType;
  /** Programming languages used */
  languages: string[];
  /** Framework information */
  frameworks: FrameworkInfo[];
  /** Dependencies */
  dependencies: DependencyInfo[];
  /** Workspace size */
  size: number;
  /** Number of files */
  fileCount: number;
  /** Last activity time */
  lastActivity: Date;
  /** Workspace tags */
  tags: string[];
}

/**
 * Workspace types
 */
export enum WorkspaceType {
  /** Web application */
  WEB_APP = "web_app",
  /** Mobile application */
  MOBILE_APP = "mobile_app",
  /** Desktop application */
  DESKTOP_APP = "desktop_app",
  /** Library or package */
  LIBRARY = "library",
  /** Machine learning project */
  ML_PROJECT = "ml_project",
  /** Data science project */
  DATA_SCIENCE = "data_science",
  /** General project */
  GENERAL = "general",
}

/**
 * Framework information
 */
export interface FrameworkInfo {
  /** Framework name */
  name: string;
  /** Framework version */
  version: string;
  /** Framework type */
  type: FrameworkType;
  /** Whether it's a dev dependency */
  isDevDependency: boolean;
}

/**
 * Framework types
 */
export enum FrameworkType {
  /** Frontend framework */
  FRONTEND = "frontend",
  /** Backend framework */
  BACKEND = "backend",
  /** Full-stack framework */
  FULL_STACK = "full_stack",
  /** Testing framework */
  TESTING = "testing",
  /** Build tool */
  BUILD_TOOL = "build_tool",
  /** Other framework */
  OTHER = "other",
}

/**
 * Dependency information
 */
export interface DependencyInfo {
  /** Package name */
  name: string;
  /** Package version */
  version: string;
  /** Package type */
  type: DependencyType;
  /** Whether it's a dev dependency */
  isDevDependency: boolean;
  /** Package description */
  description?: string;
  /** Package homepage */
  homepage?: string;
}

/**
 * Dependency types
 */
export enum DependencyType {
  /** Runtime dependency */
  RUNTIME = "runtime",
  /** Development dependency */
  DEVELOPMENT = "development",
  /** Peer dependency */
  PEER = "peer",
  /** Optional dependency */
  OPTIONAL = "optional",
  /** Bundled dependency */
  BUNDLED = "bundled",
}

/**
 * AI context information
 */
export interface AIContext {
  /** AI agent identifier */
  agentId: string;
  /** AI agent type */
  agentType: AgentType;
  /** AI agent capabilities */
  capabilities: string[];
  /** Current AI session */
  session: AISession;
  /** AI preferences */
  preferences: AIPreferences;
  /** AI history */
  history: AIHistoryEntry[];
}

/**
 * AI agent types
 */
export enum AgentType {
  /** Cursor AI */
  CURSOR_AI = "cursor_ai",
  /** Claude Assistant */
  CLAUDE_ASSISTANT = "claude_assistant",
  /** GitHub Copilot */
  GITHUB_COPILOT = "github_copilot",
  /** Custom AI agent */
  CUSTOM = "custom",
}

/**
 * AI session information
 */
export interface AISession {
  /** Session identifier */
  sessionId: string;
  /** Session start time */
  startTime: Date;
  /** Last activity time */
  lastActivity: Date;
  /** Session duration */
  duration: number;
  /** Number of interactions */
  interactionCount: number;
  /** Session context */
  context: Record<string, unknown>;
}

/**
 * AI preferences
 */
export interface AIPreferences {
  /** Preferred file types */
  preferredFileTypes: string[];
  /** Preferred operations */
  preferredOperations: string[];
  /** Auto-sync preferences */
  autoSync: boolean;
  /** Encryption preferences */
  encryption: EncryptionPreferences;
  /** Notification preferences */
  notifications: AINotificationPreferences;
}

/**
 * Encryption preferences for AI
 */
export interface EncryptionPreferences {
  /** Whether to encrypt by default */
  encryptByDefault: boolean;
  /** Encryption strength */
  strength: EncryptionStrength;
  /** Key management preferences */
  keyManagement: KeyManagementPreferences;
}

/**
 * Encryption strength levels
 */
export enum EncryptionStrength {
  /** Standard encryption */
  STANDARD = "standard",
  /** High encryption */
  HIGH = "high",
  /** Maximum encryption */
  MAXIMUM = "maximum",
}

/**
 * Key management preferences
 */
export interface KeyManagementPreferences {
  /** Key storage method */
  storageMethod: KeyStorageMethod;
  /** Key rotation frequency */
  rotationFrequency: number;
  /** Backup preferences */
  backup: BackupPreferences;
}

/**
 * Key storage methods
 */
export enum KeyStorageMethod {
  /** Local storage */
  LOCAL = "local",
  /** Cloud storage */
  CLOUD = "cloud",
  /** Hardware security module */
  HSM = "hsm",
  /** Distributed storage */
  DISTRIBUTED = "distributed",
}

/**
 * Backup preferences
 */
export interface BackupPreferences {
  /** Whether backup is enabled */
  enabled: boolean;
  /** Backup frequency */
  frequency: number;
  /** Number of backups to keep */
  keepCount: number;
  /** Backup location */
  location: string;
}

/**
 * AI notification preferences
 */
export interface AINotificationPreferences {
  /** Operation notifications */
  operations: boolean;
  /** Error notifications */
  errors: boolean;
  /** Progress notifications */
  progress: boolean;
  /** Completion notifications */
  completion: boolean;
}

/**
 * AI history entry
 */
export interface AIHistoryEntry {
  /** Entry identifier */
  id: string;
  /** Entry timestamp */
  timestamp: Date;
  /** Entry type */
  type: HistoryEntryType;
  /** Entry description */
  description: string;
  /** Entry data */
  data: Record<string, unknown>;
  /** Entry result */
  result?: HistoryEntryResult;
}

/**
 * History entry types
 */
export enum HistoryEntryType {
  /** File operation */
  FILE_OPERATION = "file_operation",
  /** Dataset operation */
  DATASET_OPERATION = "dataset_operation",
  /** AI interaction */
  AI_INTERACTION = "ai_interaction",
  /** System event */
  SYSTEM_EVENT = "system_event",
  /** Error event */
  ERROR_EVENT = "error_event",
}

/**
 * History entry result
 */
export interface HistoryEntryResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data */
  data?: Record<string, unknown>;
  /** Error information */
  error?: string;
  /** Execution time */
  executionTime: number;
}

/**
 * Workspace configuration
 */
export interface WorkspaceConfiguration {
  /** Auto-sync settings */
  autoSync: AutoSyncConfiguration;
  /** Encryption settings */
  encryption: EncryptionConfiguration;
  /** AI integration settings */
  aiIntegration: AIIntegrationConfiguration;
  /** Performance settings */
  performance: PerformanceConfiguration;
}

/**
 * Auto-sync configuration
 */
export interface AutoSyncConfiguration {
  /** Whether auto-sync is enabled */
  enabled: boolean;
  /** Sync interval in milliseconds */
  interval: number;
  /** File types to sync */
  fileTypes: string[];
  /** Exclude patterns */
  excludePatterns: string[];
  /** Include patterns */
  includePatterns: string[];
}

/**
 * Encryption configuration
 */
export interface EncryptionConfiguration {
  /** Default encryption setting */
  defaultEncryption: boolean;
  /** Encryption algorithm */
  algorithm: string;
  /** Key size */
  keySize: number;
  /** Key derivation function */
  keyDerivation: string;
}

/**
 * AI integration configuration
 */
export interface AIIntegrationConfiguration {
  /** Whether AI integration is enabled */
  enabled: boolean;
  /** Supported AI agents */
  supportedAgents: AgentType[];
  /** AI capabilities */
  capabilities: string[];
  /** AI preferences */
  preferences: Record<string, unknown>;
}

/**
 * Performance configuration
 */
export interface PerformanceConfiguration {
  /** Maximum concurrent operations */
  maxConcurrentOperations: number;
  /** Cache settings */
  cache: CacheConfiguration;
  /** Timeout settings */
  timeouts: TimeoutConfiguration;
}

/**
 * Cache configuration
 */
export interface CacheConfiguration {
  /** Whether caching is enabled */
  enabled: boolean;
  /** Cache size limit */
  sizeLimit: number;
  /** Cache TTL */
  ttl: number;
  /** Cache storage type */
  storageType: CacheStorageType;
}

/**
 * Cache storage types
 */
export enum CacheStorageType {
  /** Memory cache */
  MEMORY = "memory",
  /** Disk cache */
  DISK = "disk",
  /** Hybrid cache */
  HYBRID = "hybrid",
}

/**
 * Timeout configuration
 */
export interface TimeoutConfiguration {
  /** Default timeout */
  default: number;
  /** Upload timeout */
  upload: number;
  /** Download timeout */
  download: number;
  /** AI operation timeout */
  aiOperation: number;
}
