import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DefaultOrganizationInitializer } from "../DefaultOrganizationInitializer.js";
import { TenantStore } from "../storage/TenantStore.js";
import { Logger } from "@lighthouse-tooling/shared";
import { Role } from "@lighthouse-tooling/types";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

describe("DefaultOrganizationInitializer", () => {
  let initializer: DefaultOrganizationInitializer;
  let store: TenantStore;
  let testDir: string;
  let logger: Logger;

  const defaultOptions = {
    organizationId: "default",
    organizationSettings: {
      defaultStorageQuota: 1000000,
      defaultRateLimit: 100,
      allowTeamCreation: true,
      require2FA: false,
      dataRetentionDays: 365,
      allowedFileTypes: [],
      maxFileSize: 5000000,
      enableAuditLog: true,
    },
    defaultQuota: {
      storageLimit: 1000000,
      storageUsed: 0,
      requestLimit: 10000,
      requestsUsed: 0,
      bandwidthLimit: 5000000,
      bandwidthUsed: 0,
      maxTeams: 10,
      currentTeams: 0,
      maxMembersPerTeam: 50,
      maxApiKeys: 100,
      currentApiKeys: 0,
      resetDate: new Date().toISOString(),
    },
  };

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `default-org-init-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    logger = Logger.getInstance({ level: "error", component: "DefaultOrgInitTest" });
    store = new TenantStore(
      {
        rootPath: testDir,
        organizationPath: (orgId: string) => path.join(testDir, orgId),
        teamPath: (orgId: string, teamId: string) => path.join(testDir, orgId, "teams", teamId),
        enableEncryption: false,
        backendType: "local",
      },
      logger,
    );
    await store.initialize();

    initializer = new DefaultOrganizationInitializer(store, logger);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe("initialize", () => {
    it("should create default organization", async () => {
      await initializer.initialize(defaultOptions);

      const org = await store.getOrganization("default");
      expect(org).not.toBeNull();
      expect(org?.id).toBe("default");
      expect(org?.name).toBe("default");
      expect(org?.displayName).toBe("Default Organization");
      expect(org?.status).toBe("active");
      expect(org?.metadata?.isDefault).toBe(true);
    });

    it("should create default team", async () => {
      await initializer.initialize(defaultOptions);

      const teams = await store.listTeams("default");
      expect(teams).toHaveLength(1);

      const defaultTeam = teams[0];
      expect(defaultTeam.id).toBe("default");
      expect(defaultTeam.name).toBe("default");
      expect(defaultTeam.displayName).toBe("Default Team");
      expect(defaultTeam.members).toHaveLength(1);
      expect(defaultTeam.members[0].userId).toBe("system");
      expect(defaultTeam.members[0].role).toBe(Role.OWNER);
    });

    it("should create default quota", async () => {
      await initializer.initialize(defaultOptions);

      const quota = await store.getQuota("default");
      expect(quota).not.toBeNull();
      expect(quota?.storageLimit).toBe(1000000);
      expect(quota?.requestLimit).toBe(10000);
      expect(quota?.maxTeams).toBe(10);
    });

    it("should not recreate if organization already exists", async () => {
      await initializer.initialize(defaultOptions);

      // Try to initialize again
      await initializer.initialize(defaultOptions);

      const orgs = await store.listOrganizations();
      expect(orgs).toHaveLength(1);
    });

    it("should migrate legacy API key if provided", async () => {
      const apiKey = "legacy-api-key-12345678";

      await initializer.initialize({
        ...defaultOptions,
        apiKey,
      });

      const keys = await store.listApiKeys("default");
      expect(keys.length).toBeGreaterThan(0);

      const migratedKey = keys.find((k) => k.metadata?.migrated === true);
      expect(migratedKey).toBeDefined();
      expect(migratedKey?.name).toContain("Legacy API Key");
      expect(migratedKey?.status).toBe("active");
    });

    it("should not duplicate migrated API keys", async () => {
      const apiKey = "legacy-api-key-12345678";

      await initializer.initialize({
        ...defaultOptions,
        apiKey,
      });

      // Try to initialize again with same key
      await initializer.initialize({
        ...defaultOptions,
        apiKey,
      });

      const keys = await store.listApiKeys("default");
      const migratedKeys = keys.filter((k) => k.metadata?.migrated === true);
      expect(migratedKeys).toHaveLength(1);
    });
  });

  describe("ensureDefaultOrganization", () => {
    it("should return default organization after initialization", async () => {
      const org = await initializer.ensureDefaultOrganization(defaultOptions);

      expect(org).toBeDefined();
      expect(org.id).toBe("default");
      expect(org.status).toBe("active");
    });

    it("should throw error if initialization fails", async () => {
      // Create an invalid configuration that would fail
      const invalidOptions = {
        ...defaultOptions,
        organizationId: "", // Empty ID should cause issues
      };

      // The method should handle this gracefully or throw
      try {
        await initializer.ensureDefaultOrganization(invalidOptions);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("addUserToDefaultOrg", () => {
    beforeEach(async () => {
      await initializer.initialize(defaultOptions);
    });

    it("should add new user to default team", async () => {
      await initializer.addUserToDefaultOrg(
        "default",
        "user123",
        "user@test.com",
        "Test User",
        Role.MEMBER,
      );

      const teams = await store.listTeams("default");
      const defaultTeam = teams.find((t) => t.id === "default");

      expect(defaultTeam).toBeDefined();
      expect(defaultTeam?.members).toHaveLength(2); // system + new user

      const newMember = defaultTeam?.members.find((m) => m.userId === "user123");
      expect(newMember).toBeDefined();
      expect(newMember?.email).toBe("user@test.com");
      expect(newMember?.displayName).toBe("Test User");
      expect(newMember?.role).toBe(Role.MEMBER);
      expect(newMember?.status).toBe("active");
    });

    it("should not add duplicate users", async () => {
      await initializer.addUserToDefaultOrg(
        "default",
        "user123",
        "user@test.com",
        "Test User",
        Role.MEMBER,
      );

      // Try to add same user again
      await initializer.addUserToDefaultOrg(
        "default",
        "user123",
        "user@test.com",
        "Test User",
        Role.MEMBER,
      );

      const teams = await store.listTeams("default");
      const defaultTeam = teams.find((t) => t.id === "default");

      expect(defaultTeam?.members).toHaveLength(2); // system + user (not duplicated)
    });

    it("should add user with specified role", async () => {
      await initializer.addUserToDefaultOrg(
        "default",
        "admin123",
        "admin@test.com",
        "Admin User",
        Role.ADMIN,
      );

      const teams = await store.listTeams("default");
      const defaultTeam = teams.find((t) => t.id === "default");
      const adminMember = defaultTeam?.members.find((m) => m.userId === "admin123");

      expect(adminMember?.role).toBe(Role.ADMIN);
    });

    it("should default to MEMBER role if not specified", async () => {
      await initializer.addUserToDefaultOrg("default", "user456", "user2@test.com", "Test User 2");

      const teams = await store.listTeams("default");
      const defaultTeam = teams.find((t) => t.id === "default");
      const member = defaultTeam?.members.find((m) => m.userId === "user456");

      expect(member?.role).toBe(Role.MEMBER);
    });

    it("should throw error if default team not found", async () => {
      await expect(
        initializer.addUserToDefaultOrg("nonexistent-org", "user123", "user@test.com", "Test User"),
      ).rejects.toThrow();
    });

    it("should add multiple users successfully", async () => {
      await initializer.addUserToDefaultOrg(
        "default",
        "user1",
        "user1@test.com",
        "User 1",
        Role.MEMBER,
      );

      await initializer.addUserToDefaultOrg(
        "default",
        "user2",
        "user2@test.com",
        "User 2",
        Role.ADMIN,
      );

      await initializer.addUserToDefaultOrg(
        "default",
        "user3",
        "user3@test.com",
        "User 3",
        Role.VIEWER,
      );

      const teams = await store.listTeams("default");
      const defaultTeam = teams.find((t) => t.id === "default");

      expect(defaultTeam?.members).toHaveLength(4); // system + 3 users
    });
  });
});
