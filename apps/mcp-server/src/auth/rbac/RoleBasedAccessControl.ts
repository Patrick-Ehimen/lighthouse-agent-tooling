/**
 * Role-Based Access Control (RBAC) Implementation
 * Manages permissions and access control for multi-tenant system
 */

import {
  Role,
  Permission,
  ROLE_PERMISSIONS,
  TenantContext,
  TeamMember,
} from "@lighthouse-tooling/types";

/**
 * Access decision result
 */
export interface AccessDecision {
  /** Whether access is granted */
  granted: boolean;
  /** Reason for the decision */
  reason: string;
  /** Missing permissions if access denied */
  missingPermissions?: Permission[];
}

/**
 * Access control policy
 */
export interface AccessPolicy {
  /** Resource type */
  resource: string;
  /** Action being performed */
  action: string;
  /** Required permissions */
  requiredPermissions: Permission[];
}

/**
 * Role-Based Access Control Manager
 */
export class RoleBasedAccessControl {
  /**
   * Check if a user has a specific permission
   */
  public hasPermission(
    user: TeamMember,
    permission: Permission,
    customPermissions?: Permission[],
  ): boolean {
    // If custom permissions are provided (e.g., from API key), use those
    if (customPermissions && customPermissions.length > 0) {
      return customPermissions.includes(permission);
    }

    // Otherwise, check role-based permissions
    const rolePermissions = ROLE_PERMISSIONS[user.role];
    return rolePermissions.includes(permission);
  }

  /**
   * Check if a user has all required permissions
   */
  public hasAllPermissions(
    user: TeamMember,
    permissions: Permission[],
    customPermissions?: Permission[],
  ): boolean {
    return permissions.every((permission) =>
      this.hasPermission(user, permission, customPermissions),
    );
  }

  /**
   * Check if a user has any of the required permissions
   */
  public hasAnyPermission(
    user: TeamMember,
    permissions: Permission[],
    customPermissions?: Permission[],
  ): boolean {
    return permissions.some((permission) =>
      this.hasPermission(user, permission, customPermissions),
    );
  }

  /**
   * Get all permissions for a user
   */
  public getUserPermissions(user: TeamMember, customPermissions?: Permission[]): Permission[] {
    if (customPermissions && customPermissions.length > 0) {
      return customPermissions;
    }

    return ROLE_PERMISSIONS[user.role] || [];
  }

  /**
   * Check access against a policy
   */
  public checkAccess(context: TenantContext, policy: AccessPolicy): AccessDecision {
    const userPermissions = context.permissions;
    const requiredPermissions = policy.requiredPermissions;

    const missingPermissions = requiredPermissions.filter(
      (permission) => !userPermissions.includes(permission),
    );

    if (missingPermissions.length === 0) {
      return {
        granted: true,
        reason: `User has all required permissions for ${policy.resource}:${policy.action}`,
      };
    }

    return {
      granted: false,
      reason: `User lacks required permissions for ${policy.resource}:${policy.action}`,
      missingPermissions,
    };
  }

  /**
   * Check if user can perform action on resource
   */
  public canPerformAction(
    context: TenantContext,
    resource: string,
    action: string,
    requiredPermissions: Permission[],
  ): AccessDecision {
    const policy: AccessPolicy = {
      resource,
      action,
      requiredPermissions,
    };

    return this.checkAccess(context, policy);
  }

  /**
   * Assert that user has permission (throws if not)
   */
  public assertPermission(
    user: TeamMember,
    permission: Permission,
    customPermissions?: Permission[],
  ): void {
    if (!this.hasPermission(user, permission, customPermissions)) {
      throw new PermissionDeniedError(`User does not have permission: ${permission}`, [permission]);
    }
  }

  /**
   * Assert that user has all permissions (throws if not)
   */
  public assertAllPermissions(
    user: TeamMember,
    permissions: Permission[],
    customPermissions?: Permission[],
  ): void {
    const missingPermissions = permissions.filter(
      (permission) => !this.hasPermission(user, permission, customPermissions),
    );

    if (missingPermissions.length > 0) {
      throw new PermissionDeniedError(
        `User does not have required permissions`,
        missingPermissions,
      );
    }
  }

  /**
   * Check if user is owner of organization
   */
  public isOrganizationOwner(context: TenantContext): boolean {
    return context.user.userId === context.organization.ownerId && context.user.role === Role.OWNER;
  }

  /**
   * Check if user is team owner/admin
   */
  public isTeamAdmin(context: TenantContext): boolean {
    if (!context.team) {
      return false;
    }

    return context.user.role === Role.OWNER || context.user.role === Role.ADMIN;
  }

  /**
   * Filter resources based on user permissions
   */
  public filterByPermission<T extends { requiredPermission?: Permission }>(
    user: TeamMember,
    resources: T[],
    customPermissions?: Permission[],
  ): T[] {
    return resources.filter((resource) => {
      if (!resource.requiredPermission) {
        return true; // No permission required
      }

      return this.hasPermission(user, resource.requiredPermission, customPermissions);
    });
  }

  /**
   * Create a hierarchical permission check
   * Checks if a lower-level user can modify a higher-level user
   */
  public canModifyUser(actor: TeamMember, target: TeamMember): AccessDecision {
    const roleHierarchy = {
      [Role.OWNER]: 4,
      [Role.ADMIN]: 3,
      [Role.MEMBER]: 2,
      [Role.VIEWER]: 1,
    };

    const actorLevel = roleHierarchy[actor.role];
    const targetLevel = roleHierarchy[target.role];

    // Owner can modify anyone
    if (actor.role === Role.OWNER) {
      return {
        granted: true,
        reason: "Owner can modify any user",
      };
    }

    // Admin can modify members and viewers
    if (actor.role === Role.ADMIN && (target.role === Role.MEMBER || target.role === Role.VIEWER)) {
      return {
        granted: true,
        reason: "Admin can modify members and viewers",
      };
    }

    // Cannot modify someone with higher or equal role
    if (actorLevel && targetLevel && actorLevel <= targetLevel) {
      return {
        granted: false,
        reason: "Cannot modify user with equal or higher role",
      };
    }

    return {
      granted: true,
      reason: "User has sufficient role level",
    };
  }
}

/**
 * Permission denied error
 */
export class PermissionDeniedError extends Error {
  constructor(
    message: string,
    public readonly missingPermissions: Permission[],
  ) {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

/**
 * Default RBAC instance
 */
export const rbac = new RoleBasedAccessControl();
