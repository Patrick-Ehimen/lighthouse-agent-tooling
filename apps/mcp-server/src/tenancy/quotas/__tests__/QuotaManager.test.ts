import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { QuotaManager } from "../QuotaManager.js";
import { TenantStore } from "../../storage/TenantStore.js";
import { Logger } from "@lighthouse-tooling/shared";
import { TenantContext, Organization, UsageQuota, Role } from "@lighthouse-tooling/types";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

describe("QuotaManager", () => {
  let manager: QuotaManager;
  let store: TenantStore;
  let testDir: string;
  let logger: Logger;
  let testContext: TenantContext;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `quota-manager-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    logger = Logger.getInstance({ level: "error", component: "QuotaManagerTest" });
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

    manager = new QuotaManager({ store, logger, enableAutoReset: false });

    const org: Organization = {
      id: "test-org",
      name: "test-org",
      displayName: "Test Organization",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: "user123",
      settings: {} as any,
      status: "active",
    };

    // Set reset date to next month to avoid automatic reset during tests
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const quota: UsageQuota = {
      storageLimit: 1000000,
      storageUsed: 0,
      requestLimit: 1000,
      requestsUsed: 0,
      bandwidthLimit: 5000000,
      bandwidthUsed: 0,
      maxTeams: 10,
      currentTeams: 1,
      maxMembersPerTeam: 50,
      maxApiKeys: 100,
      currentApiKeys: 1,
      resetDate: nextMonth.toISOString(),
    };

    await store.saveOrganization(org);
    await store.saveQuota("test-org", quota);

    testContext = {
      organization: org,
      user: {
        userId: "user123",
        email: "user@test.com",
        displayName: "Test User",
        role: Role.OWNER,
        joinedAt: new Date().toISOString(),
        status: "active",
      },
      apiKey: {} as any,
      permissions: [],
      quota,
    };
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe("Quota Checking", () => {
    it("should allow operation within storage limit", async () => {
      const result = await manager.checkQuota(testContext, "storage", 500000);

      expect(result.allowed).toBe(true);
    });

    it("should deny operation exceeding storage limit", async () => {
      const result = await manager.checkQuota(testContext, "storage", 2000000);

      expect(result.allowed).toBe(false);
    });

    it("should allow operation within request limit", async () => {
      const result = await manager.checkQuota(testContext, "request", 1);

      expect(result.allowed).toBe(true);
    });

    it("should deny operation exceeding request limit", async () => {
      testContext.quota.requestsUsed = 1000;
      const result = await manager.checkQuota(testContext, "request", 1);

      expect(result.allowed).toBe(false);
    });
  });

  describe("Usage Recording", () => {
    it("should record storage usage", async () => {
      await manager.recordUsage(testContext, { storage: 100000 });

      const quota = await store.getQuota("test-org");
      expect(quota?.storageUsed).toBe(100000);
    });

    it("should record multiple usage types", async () => {
      await manager.recordUsage(testContext, {
        storage: 100000,
        requests: 5,
        bandwidth: 200000,
      });

      const quota = await store.getQuota("test-org");
      expect(quota?.storageUsed).toBe(100000);
      expect(quota?.requestsUsed).toBe(5);
      expect(quota?.bandwidthUsed).toBe(200000);
    });

    it("should accumulate usage", async () => {
      await manager.recordUsage(testContext, { storage: 100000 });
      await manager.recordUsage(testContext, { storage: 50000 });

      const quota = await store.getQuota("test-org");
      expect(quota?.storageUsed).toBe(150000);
    });
  });

  describe("Quota Status", () => {
    it("should calculate usage percentages", () => {
      testContext.quota.storageUsed = 500000;
      testContext.quota.requestsUsed = 500;

      const status = manager.getQuotaStatus(testContext.quota);

      expect(status.storage.percentage).toBe(50);
      expect(status.requests.percentage).toBe(50);
    });

    it("should calculate near limit percentage", () => {
      testContext.quota.storageUsed = 850000;

      const status = manager.getQuotaStatus(testContext.quota);

      expect(status.storage.percentage).toBe(85);
      expect(status.storage.percentage).toBeGreaterThan(80);
    });

    it("should calculate at limit percentage", () => {
      testContext.quota.storageUsed = 1000000;

      const status = manager.getQuotaStatus(testContext.quota);

      expect(status.storage.percentage).toBe(100);
    });
  });

  describe("Quota Reset", () => {
    it("should reset monthly quota", async () => {
      testContext.quota.requestsUsed = 500;
      testContext.quota.bandwidthUsed = 2000000;
      await store.saveQuota("test-org", testContext.quota);

      await manager.resetMonthlyQuota("test-org");

      const quota = await store.getQuota("test-org");
      expect(quota?.requestsUsed).toBe(0);
      expect(quota?.bandwidthUsed).toBe(0);
    });
  });
});
