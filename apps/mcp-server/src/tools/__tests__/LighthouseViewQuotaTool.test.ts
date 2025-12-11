import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LighthouseViewQuotaTool } from "../LighthouseViewQuotaTool.js";
import { TenantStore } from "../../tenancy/storage/TenantStore.js";
import { QuotaManager } from "../../tenancy/quotas/QuotaManager.js";
import { Logger } from "@lighthouse-tooling/shared";
import { Organization, Role } from "@lighthouse-tooling/types";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

describe("LighthouseViewQuotaTool", () => {
  let tool: LighthouseViewQuotaTool;
  let store: TenantStore;
  let quotaManager: QuotaManager;
  let testDir: string;
  let logger: Logger;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `view-quota-tool-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    logger = Logger.getInstance({ level: "error", component: "ViewQuotaToolTest" });
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

    quotaManager = new QuotaManager({ store, logger, enableAutoReset: false });
    tool = new LighthouseViewQuotaTool(store, quotaManager, logger);

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

    const quota = {
      storageLimit: 1000000,
      storageUsed: 300000,
      requestLimit: 10000,
      requestsUsed: 2500,
      bandwidthLimit: 5000000,
      bandwidthUsed: 1000000,
      maxTeams: 10,
      currentTeams: 2,
      maxMembersPerTeam: 50,
      maxApiKeys: 100,
      currentApiKeys: 5,
      resetDate: new Date().toISOString(),
    };

    await store.saveOrganization(org);
    await store.saveQuota("test-org", quota);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe("Tool Definition", () => {
    it("should have correct tool definition", () => {
      const def = LighthouseViewQuotaTool.getDefinition();

      expect(def.name).toBe("lighthouse-view-quota");
      expect(def.requiresAuth).toBe(true);
    });
  });

  describe("Quota Viewing", () => {
    it("should return quota information", async () => {
      const result = await tool.execute({
        organizationId: "test-org",
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it("should show usage details", async () => {
      const result = await tool.execute({
        organizationId: "test-org",
      });

      expect(result.success).toBe(true);
      expect(result.data.quota).toBeDefined();
      expect(result.data.quota.storage).toBeDefined();
      expect(result.data.quota.requests).toBeDefined();
      expect(result.data.quota.bandwidth).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should fail for non-existent organization", async () => {
      const result = await tool.execute({
        organizationId: "nonexistent",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should include execution time", async () => {
      const result = await tool.execute({
        organizationId: "test-org",
      });

      expect(result.executionTime).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });
});
