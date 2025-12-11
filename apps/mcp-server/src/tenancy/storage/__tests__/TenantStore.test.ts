import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TenantStore } from "../TenantStore.js";
import { Logger } from "@lighthouse-tooling/shared";
import { Organization, Team, TenantApiKey, Role } from "@lighthouse-tooling/types";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

describe("TenantStore", () => {
  let store: TenantStore;
  let testDir: string;
  let logger: Logger;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `tenant-store-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    logger = Logger.getInstance({ level: "error", component: "TenantStoreTest" });
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
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe("Organization Management", () => {
    it("should save and retrieve organization", async () => {
      const org: Organization = {
        id: "test-org",
        name: "test-org",
        displayName: "Test Organization",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: "user123",
        settings: {
          defaultStorageQuota: 1000000,
          defaultRateLimit: 100,
          allowTeamCreation: true,
          require2FA: false,
          dataRetentionDays: 365,
          allowedFileTypes: [],
          maxFileSize: 5000000,
          enableAuditLog: true,
        },
        status: "active",
      };

      await store.saveOrganization(org);
      const retrieved = await store.getOrganization("test-org");

      expect(retrieved).toEqual(org);
    });

    it("should return null for non-existent organization", async () => {
      const result = await store.getOrganization("nonexistent");
      expect(result).toBeNull();
    });

    it("should list all organizations", async () => {
      const org1: Organization = {
        id: "org1",
        name: "org1",
        displayName: "Organization 1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: "user1",
        settings: {} as any,
        status: "active",
      };

      const org2: Organization = {
        id: "org2",
        name: "org2",
        displayName: "Organization 2",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: "user2",
        settings: {} as any,
        status: "active",
      };

      await store.saveOrganization(org1);
      await store.saveOrganization(org2);

      const orgs = await store.listOrganizations();
      expect(orgs).toHaveLength(2);
      expect(orgs.find((o) => o.id === "org1")).toBeDefined();
      expect(orgs.find((o) => o.id === "org2")).toBeDefined();
    });
  });

  describe("Team Management", () => {
    beforeEach(async () => {
      const org: Organization = {
        id: "test-org",
        name: "test-org",
        displayName: "Test Org",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: "user123",
        settings: {} as any,
        status: "active",
      };
      await store.saveOrganization(org);
    });

    it("should save and retrieve team", async () => {
      const team: Team = {
        id: "test-team",
        organizationId: "test-org",
        name: "test-team",
        displayName: "Test Team",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: "user123",
        members: [],
        status: "active",
      };

      await store.saveTeam("test-org", team);
      const retrieved = await store.getTeam("test-org", "test-team");

      expect(retrieved).toEqual(team);
    });

    it("should return null for non-existent team", async () => {
      const result = await store.getTeam("test-org", "nonexistent");
      expect(result).toBeNull();
    });

    it("should list teams in organization", async () => {
      const team1: Team = {
        id: "team1",
        organizationId: "test-org",
        name: "team1",
        displayName: "Team 1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: "user123",
        members: [],
        status: "active",
      };

      const team2: Team = {
        id: "team2",
        organizationId: "test-org",
        name: "team2",
        displayName: "Team 2",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: "user123",
        members: [],
        status: "active",
      };

      await store.saveTeam("test-org", team1);
      await store.saveTeam("test-org", team2);

      const teams = await store.listTeams("test-org");
      expect(teams).toHaveLength(2);
    });
  });

  describe("API Key Management", () => {
    beforeEach(async () => {
      const org: Organization = {
        id: "test-org",
        name: "test-org",
        displayName: "Test Org",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: "user123",
        settings: {} as any,
        status: "active",
      };
      await store.saveOrganization(org);
    });

    it("should save and retrieve API key", async () => {
      const apiKey: TenantApiKey = {
        id: "key123",
        organizationId: "test-org",
        createdBy: "user123",
        name: "Test Key",
        key: "org_test-org_key_key123.secret",
        keyHash: "hash123",
        createdAt: new Date().toISOString(),
        status: "active",
      };

      await store.saveApiKey("test-org", apiKey);
      const retrieved = await store.getApiKey("test-org", "key123");

      expect(retrieved).toEqual(apiKey);
    });

    it("should list and find API keys", async () => {
      const apiKey: TenantApiKey = {
        id: "key123",
        organizationId: "test-org",
        createdBy: "user123",
        name: "Test Key",
        key: "org_test-org_key_key123.secret",
        keyHash: "hash123",
        createdAt: new Date().toISOString(),
        status: "active",
      };

      await store.saveApiKey("test-org", apiKey);
      const keys = await store.listApiKeys("test-org");

      expect(keys).toHaveLength(1);
      expect(keys[0].id).toBe("key123");
    });

    it("should list API keys in organization", async () => {
      const key1: TenantApiKey = {
        id: "key1",
        organizationId: "test-org",
        createdBy: "user123",
        name: "Key 1",
        key: "key1-value",
        keyHash: "hash1",
        createdAt: new Date().toISOString(),
        status: "active",
      };

      const key2: TenantApiKey = {
        id: "key2",
        organizationId: "test-org",
        createdBy: "user123",
        name: "Key 2",
        key: "key2-value",
        keyHash: "hash2",
        createdAt: new Date().toISOString(),
        status: "active",
      };

      await store.saveApiKey("test-org", key1);
      await store.saveApiKey("test-org", key2);

      const keys = await store.listApiKeys("test-org");
      expect(keys).toHaveLength(2);
    });
  });

  describe("Quota Management", () => {
    beforeEach(async () => {
      const org: Organization = {
        id: "test-org",
        name: "test-org",
        displayName: "Test Org",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: "user123",
        settings: {} as any,
        status: "active",
      };
      await store.saveOrganization(org);
    });

    it("should save and retrieve quota", async () => {
      const quota = {
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
      };

      await store.saveQuota("test-org", quota);
      const retrieved = await store.getQuota("test-org");

      expect(retrieved).toEqual(quota);
    });

    it("should update quota usage", async () => {
      const quota = {
        storageLimit: 1000000,
        storageUsed: 100,
        requestLimit: 10000,
        requestsUsed: 5,
        bandwidthLimit: 5000000,
        bandwidthUsed: 1000,
        maxTeams: 10,
        currentTeams: 1,
        maxMembersPerTeam: 50,
        maxApiKeys: 100,
        currentApiKeys: 2,
        resetDate: new Date().toISOString(),
      };

      await store.saveQuota("test-org", quota);

      quota.storageUsed = 200;
      quota.requestsUsed = 10;
      await store.saveQuota("test-org", quota);

      const retrieved = await store.getQuota("test-org");
      expect(retrieved?.storageUsed).toBe(200);
      expect(retrieved?.requestsUsed).toBe(10);
    });
  });
});
