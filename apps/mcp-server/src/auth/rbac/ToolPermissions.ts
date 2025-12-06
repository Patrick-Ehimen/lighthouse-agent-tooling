/**
 * MCP Tool Permission Mappings
 * Defines required permissions for each MCP tool
 */

import { Permission } from "@lighthouse-tooling/types";
import { AccessPolicy } from "./RoleBasedAccessControl.js";

/**
 * Tool permission requirements mapping
 */
export const TOOL_PERMISSIONS: Record<string, AccessPolicy> = {
  // File upload tool
  "lighthouse-upload": {
    resource: "file",
    action: "upload",
    requiredPermissions: [Permission.FILE_UPLOAD],
  },

  // File download tool
  "lighthouse-download": {
    resource: "file",
    action: "download",
    requiredPermissions: [Permission.FILE_DOWNLOAD],
  },

  // File status tool
  "lighthouse-get-upload-status": {
    resource: "file",
    action: "read",
    requiredPermissions: [Permission.FILE_LIST],
  },

  // File list tool
  "lighthouse-list-files": {
    resource: "file",
    action: "list",
    requiredPermissions: [Permission.FILE_LIST],
  },

  // Dataset creation tool
  "lighthouse-create-dataset": {
    resource: "dataset",
    action: "create",
    requiredPermissions: [Permission.DATASET_CREATE],
  },

  // Dataset retrieval tool
  "lighthouse-get-dataset": {
    resource: "dataset",
    action: "read",
    requiredPermissions: [Permission.DATASET_READ],
  },

  // Dataset listing tool
  "lighthouse-list-datasets": {
    resource: "dataset",
    action: "list",
    requiredPermissions: [Permission.DATASET_LIST],
  },

  // Dataset deletion tool
  "lighthouse-delete-dataset": {
    resource: "dataset",
    action: "delete",
    requiredPermissions: [Permission.DATASET_DELETE],
  },

  // File sharing tool
  "lighthouse-share-file": {
    resource: "file",
    action: "share",
    requiredPermissions: [Permission.FILE_SHARE],
  },

  // File deletion tool
  "lighthouse-delete-file": {
    resource: "file",
    action: "delete",
    requiredPermissions: [Permission.FILE_DELETE],
  },

  // API key management tools
  "lighthouse-create-api-key": {
    resource: "api_key",
    action: "create",
    requiredPermissions: [Permission.API_KEY_CREATE],
  },

  "lighthouse-list-api-keys": {
    resource: "api_key",
    action: "list",
    requiredPermissions: [Permission.API_KEY_LIST],
  },

  "lighthouse-revoke-api-key": {
    resource: "api_key",
    action: "revoke",
    requiredPermissions: [Permission.API_KEY_REVOKE],
  },

  // Team management tools
  "lighthouse-create-team": {
    resource: "team",
    action: "create",
    requiredPermissions: [Permission.TEAM_CREATE],
  },

  "lighthouse-get-team": {
    resource: "team",
    action: "read",
    requiredPermissions: [Permission.TEAM_READ],
  },

  "lighthouse-update-team": {
    resource: "team",
    action: "update",
    requiredPermissions: [Permission.TEAM_UPDATE],
  },

  "lighthouse-delete-team": {
    resource: "team",
    action: "delete",
    requiredPermissions: [Permission.TEAM_DELETE],
  },

  "lighthouse-add-team-member": {
    resource: "team",
    action: "manage_members",
    requiredPermissions: [Permission.TEAM_MANAGE_MEMBERS],
  },

  "lighthouse-remove-team-member": {
    resource: "team",
    action: "manage_members",
    requiredPermissions: [Permission.TEAM_MANAGE_MEMBERS],
  },

  // Organization management tools
  "lighthouse-update-organization": {
    resource: "organization",
    action: "update",
    requiredPermissions: [Permission.ORG_UPDATE],
  },

  "lighthouse-view-usage": {
    resource: "organization",
    action: "view_usage",
    requiredPermissions: [Permission.ORG_VIEW_USAGE],
  },

  "lighthouse-update-quota": {
    resource: "quota",
    action: "update",
    requiredPermissions: [Permission.QUOTA_UPDATE],
  },
};

/**
 * Get required permissions for a tool
 */
export function getToolPermissions(toolName: string): Permission[] {
  const policy = TOOL_PERMISSIONS[toolName];
  return policy ? policy.requiredPermissions : [];
}

/**
 * Check if a tool requires specific permission
 */
export function toolRequiresPermission(toolName: string, permission: Permission): boolean {
  const permissions = getToolPermissions(toolName);
  return permissions.includes(permission);
}

/**
 * Get all tools accessible with given permissions
 */
export function getAccessibleTools(userPermissions: Permission[]): string[] {
  return Object.entries(TOOL_PERMISSIONS)
    .filter(([, policy]) =>
      policy.requiredPermissions.every((permission) => userPermissions.includes(permission)),
    )
    .map(([toolName]) => toolName);
}

/**
 * Get tool access policy
 */
export function getToolPolicy(toolName: string): AccessPolicy | undefined {
  return TOOL_PERMISSIONS[toolName];
}
