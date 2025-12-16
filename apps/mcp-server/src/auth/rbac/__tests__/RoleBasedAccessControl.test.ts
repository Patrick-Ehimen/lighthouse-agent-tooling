import { describe, it, expect, beforeEach } from "vitest";
import { RoleBasedAccessControl, PermissionDeniedError } from "../RoleBasedAccessControl.js";
import { Role, Permission, TeamMember, TenantContext } from "@lighthouse-tooling/types";

describe("RoleBasedAccessControl", () => {
  let rbac: RoleBasedAccessControl;
  let ownerUser: TeamMember;
  let adminUser: TeamMember;
  let memberUser: TeamMember;
  let viewerUser: TeamMember;

  beforeEach(() => {
    rbac = new RoleBasedAccessControl();

    ownerUser = {
      userId: "owner1",
      email: "owner@test.com",
      displayName: "Owner User",
      role: Role.OWNER,
      joinedAt: new Date().toISOString(),
      status: "active",
    };

    adminUser = {
      userId: "admin1",
      email: "admin@test.com",
      displayName: "Admin User",
      role: Role.ADMIN,
      joinedAt: new Date().toISOString(),
      status: "active",
    };

    memberUser = {
      userId: "member1",
      email: "member@test.com",
      displayName: "Member User",
      role: Role.MEMBER,
      joinedAt: new Date().toISOString(),
      status: "active",
    };

    viewerUser = {
      userId: "viewer1",
      email: "viewer@test.com",
      displayName: "Viewer User",
      role: Role.VIEWER,
      joinedAt: new Date().toISOString(),
      status: "active",
    };
  });

  describe("Permission Checking", () => {
    it("should grant all permissions to owner", () => {
      expect(rbac.hasPermission(ownerUser, Permission.FILE_UPLOAD)).toBe(true);
      expect(rbac.hasPermission(ownerUser, Permission.FILE_DELETE)).toBe(true);
      expect(rbac.hasPermission(ownerUser, Permission.ORG_UPDATE)).toBe(true);
      expect(rbac.hasPermission(ownerUser, Permission.TEAM_DELETE)).toBe(true);
    });

    it("should grant admin permissions to admin", () => {
      expect(rbac.hasPermission(adminUser, Permission.FILE_UPLOAD)).toBe(true);
      expect(rbac.hasPermission(adminUser, Permission.FILE_DELETE)).toBe(true);
      expect(rbac.hasPermission(adminUser, Permission.TEAM_MANAGE_MEMBERS)).toBe(true);
      expect(rbac.hasPermission(adminUser, Permission.API_KEY_CREATE)).toBe(true);
    });

    it("should deny org-level permissions to admin", () => {
      expect(rbac.hasPermission(adminUser, Permission.ORG_UPDATE)).toBe(false);
      expect(rbac.hasPermission(adminUser, Permission.TEAM_DELETE)).toBe(false);
      expect(rbac.hasPermission(adminUser, Permission.QUOTA_UPDATE)).toBe(false);
    });

    it("should grant member permissions to member", () => {
      expect(rbac.hasPermission(memberUser, Permission.FILE_UPLOAD)).toBe(true);
      expect(rbac.hasPermission(memberUser, Permission.FILE_DOWNLOAD)).toBe(true);
      expect(rbac.hasPermission(memberUser, Permission.DATASET_CREATE)).toBe(true);
      expect(rbac.hasPermission(memberUser, Permission.DATASET_UPDATE)).toBe(true);
    });

    it("should deny destructive permissions to member", () => {
      expect(rbac.hasPermission(memberUser, Permission.FILE_DELETE)).toBe(false);
      expect(rbac.hasPermission(memberUser, Permission.DATASET_DELETE)).toBe(false);
      expect(rbac.hasPermission(memberUser, Permission.TEAM_MANAGE_MEMBERS)).toBe(false);
    });

    it("should grant only read permissions to viewer", () => {
      expect(rbac.hasPermission(viewerUser, Permission.FILE_DOWNLOAD)).toBe(true);
      expect(rbac.hasPermission(viewerUser, Permission.FILE_LIST)).toBe(true);
      expect(rbac.hasPermission(viewerUser, Permission.DATASET_READ)).toBe(true);
    });

    it("should deny write permissions to viewer", () => {
      expect(rbac.hasPermission(viewerUser, Permission.FILE_UPLOAD)).toBe(false);
      expect(rbac.hasPermission(viewerUser, Permission.DATASET_CREATE)).toBe(false);
      expect(rbac.hasPermission(viewerUser, Permission.TEAM_UPDATE)).toBe(false);
    });
  });

  describe("Custom Permissions", () => {
    it("should use custom permissions when provided", () => {
      const customPerms = [Permission.FILE_UPLOAD, Permission.FILE_DOWNLOAD];

      expect(rbac.hasPermission(viewerUser, Permission.FILE_UPLOAD, customPerms)).toBe(true);
      expect(rbac.hasPermission(viewerUser, Permission.FILE_DELETE, customPerms)).toBe(false);
    });

    it("should ignore role permissions when custom permissions set", () => {
      const customPerms = [Permission.FILE_UPLOAD];

      // Viewer normally can't upload
      expect(rbac.hasPermission(viewerUser, Permission.FILE_UPLOAD, customPerms)).toBe(true);

      // Viewer normally can download, but not in custom perms
      expect(rbac.hasPermission(viewerUser, Permission.FILE_DOWNLOAD, customPerms)).toBe(false);
    });
  });

  describe("Multiple Permission Checks", () => {
    it("should check if user has all required permissions", () => {
      const perms = [Permission.FILE_UPLOAD, Permission.FILE_DOWNLOAD, Permission.FILE_LIST];

      expect(rbac.hasAllPermissions(ownerUser, perms)).toBe(true);
      expect(rbac.hasAllPermissions(adminUser, perms)).toBe(true);
      expect(rbac.hasAllPermissions(memberUser, perms)).toBe(true);
      expect(rbac.hasAllPermissions(viewerUser, perms)).toBe(false);
    });

    it("should check if user has any of the required permissions", () => {
      const perms = [Permission.FILE_DELETE, Permission.DATASET_DELETE];

      expect(rbac.hasAnyPermission(ownerUser, perms)).toBe(true);
      expect(rbac.hasAnyPermission(adminUser, perms)).toBe(true);
      expect(rbac.hasAnyPermission(memberUser, perms)).toBe(false);
      expect(rbac.hasAnyPermission(viewerUser, perms)).toBe(false);
    });
  });

  describe("Permission Assertions", () => {
    it("should not throw for valid permission", () => {
      expect(() => {
        rbac.assertPermission(ownerUser, Permission.FILE_UPLOAD);
      }).not.toThrow();
    });

    it("should throw for invalid permission", () => {
      expect(() => {
        rbac.assertPermission(viewerUser, Permission.FILE_UPLOAD);
      }).toThrow(PermissionDeniedError);
    });

    it("should throw with missing permissions in error", () => {
      try {
        rbac.assertAllPermissions(memberUser, [Permission.FILE_DELETE, Permission.DATASET_DELETE]);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(PermissionDeniedError);
        expect((error as PermissionDeniedError).missingPermissions).toContain(
          Permission.FILE_DELETE,
        );
        expect((error as PermissionDeniedError).missingPermissions).toContain(
          Permission.DATASET_DELETE,
        );
      }
    });
  });

  describe("Access Policy Checking", () => {
    it("should grant access when user has permissions", () => {
      const mockContext: TenantContext = {
        organization: {} as any,
        user: ownerUser,
        apiKey: {} as any,
        permissions: [Permission.FILE_UPLOAD, Permission.FILE_DOWNLOAD],
        quota: {} as any,
      };

      const decision = rbac.canPerformAction(mockContext, "file", "upload", [
        Permission.FILE_UPLOAD,
      ]);

      expect(decision.granted).toBe(true);
    });

    it("should deny access when user lacks permissions", () => {
      const mockContext: TenantContext = {
        organization: {} as any,
        user: viewerUser,
        apiKey: {} as any,
        permissions: [Permission.FILE_DOWNLOAD],
        quota: {} as any,
      };

      const decision = rbac.canPerformAction(mockContext, "file", "upload", [
        Permission.FILE_UPLOAD,
      ]);

      expect(decision.granted).toBe(false);
      expect(decision.missingPermissions).toContain(Permission.FILE_UPLOAD);
    });
  });

  describe("Role Hierarchy", () => {
    it("should allow owner to modify any user", () => {
      expect(rbac.canModifyUser(ownerUser, adminUser).granted).toBe(true);
      expect(rbac.canModifyUser(ownerUser, memberUser).granted).toBe(true);
      expect(rbac.canModifyUser(ownerUser, viewerUser).granted).toBe(true);
    });

    it("should allow admin to modify member and viewer", () => {
      expect(rbac.canModifyUser(adminUser, memberUser).granted).toBe(true);
      expect(rbac.canModifyUser(adminUser, viewerUser).granted).toBe(true);
    });

    it("should prevent admin from modifying owner", () => {
      expect(rbac.canModifyUser(adminUser, ownerUser).granted).toBe(false);
    });

    it("should prevent member from modifying higher roles", () => {
      expect(rbac.canModifyUser(memberUser, adminUser).granted).toBe(false);
      expect(rbac.canModifyUser(memberUser, ownerUser).granted).toBe(false);
      // Member can modify viewers (lower role)
      expect(rbac.canModifyUser(memberUser, viewerUser).granted).toBe(true);
    });

    it("should prevent modifying user with equal role", () => {
      const admin2: TeamMember = {
        userId: "admin2",
        email: "admin2@test.com",
        displayName: "Admin 2",
        role: Role.ADMIN,
        joinedAt: new Date().toISOString(),
        status: "active",
      };

      expect(rbac.canModifyUser(adminUser, admin2).granted).toBe(false);
    });
  });

  describe("Organization and Team Checks", () => {
    it("should identify organization owner", () => {
      const mockContext: TenantContext = {
        organization: { id: "org1", ownerId: "owner1" } as any,
        user: ownerUser,
        apiKey: {} as any,
        permissions: [],
        quota: {} as any,
      };

      expect(rbac.isOrganizationOwner(mockContext)).toBe(true);
    });

    it("should reject non-owner as organization owner", () => {
      const mockContext: TenantContext = {
        organization: { id: "org1", ownerId: "owner1" } as any,
        user: adminUser,
        apiKey: {} as any,
        permissions: [],
        quota: {} as any,
      };

      expect(rbac.isOrganizationOwner(mockContext)).toBe(false);
    });

    it("should identify team admin", () => {
      const mockContext: TenantContext = {
        organization: {} as any,
        team: { id: "team1" } as any,
        user: adminUser,
        apiKey: {} as any,
        permissions: [],
        quota: {} as any,
      };

      expect(rbac.isTeamAdmin(mockContext)).toBe(true);
    });

    it("should reject member as team admin", () => {
      const mockContext: TenantContext = {
        organization: {} as any,
        team: { id: "team1" } as any,
        user: memberUser,
        apiKey: {} as any,
        permissions: [],
        quota: {} as any,
      };

      expect(rbac.isTeamAdmin(mockContext)).toBe(false);
    });
  });

  describe("Get User Permissions", () => {
    it("should return all owner permissions", () => {
      const perms = rbac.getUserPermissions(ownerUser);

      expect(perms).toContain(Permission.FILE_UPLOAD);
      expect(perms).toContain(Permission.ORG_UPDATE);
      expect(perms).toContain(Permission.TEAM_DELETE);
      expect(perms.length).toBeGreaterThan(20);
    });

    it("should return custom permissions when provided", () => {
      const customPerms = [Permission.FILE_UPLOAD, Permission.FILE_DOWNLOAD];
      const perms = rbac.getUserPermissions(viewerUser, customPerms);

      expect(perms).toEqual(customPerms);
      expect(perms).toHaveLength(2);
    });

    it("should return role permissions for each role", () => {
      const ownerPerms = rbac.getUserPermissions(ownerUser);
      const adminPerms = rbac.getUserPermissions(adminUser);
      const memberPerms = rbac.getUserPermissions(memberUser);
      const viewerPerms = rbac.getUserPermissions(viewerUser);

      expect(ownerPerms.length).toBeGreaterThan(adminPerms.length);
      expect(adminPerms.length).toBeGreaterThan(memberPerms.length);
      expect(memberPerms.length).toBeGreaterThan(viewerPerms.length);
    });
  });
});
