/**
 * RBAC Module Exports
 */

export {
  RoleBasedAccessControl,
  rbac,
  PermissionDeniedError,
  type AccessDecision,
  type AccessPolicy,
} from "./RoleBasedAccessControl.js";

export {
  TOOL_PERMISSIONS,
  getToolPermissions,
  toolRequiresPermission,
  getAccessibleTools,
  getToolPolicy,
} from "./ToolPermissions.js";
