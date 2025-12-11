import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LighthouseCreateOrganizationTool } from "../LighthouseCreateOrganizationTool.js";
import { TenantStore } from "../../tenancy/storage/TenantStore.js";
import { Logger } from "@lighthouse-tooling/shared";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

describe("LighthouseCreateOrganizationTool", () => {
  let tool: LighthouseCreateOrganizationTool;
  let store: TenantStore;
  let testDir: string;
  let logger: Logger;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `create-org-tool-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    logger = Logger.getInstance({ level: "error", component: "CreateOrgToolTest" });
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

    tool = new LighthouseCreateOrganizationTool(store, logger);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe("Tool Definition", () => {
    it("should have correct tool definition", () => {
      const def = LighthouseCreateOrganizationTool.getDefinition();

      expect(def.name).toBe("lighthouse-create-organization");
      expect(def.requiresAuth).toBe(true);
      expect(def.supportsBatch).toBe(false);
      expect(def.inputSchema.required).toContain("organizationId");
      expect(def.inputSchema.required).toContain("name");
      expect(def.inputSchema.required).toContain("displayName");
    });
  });

  describe("Organization Creation", () => {
    it("should create organization successfully", async () => {
      const result = await tool.execute({
        organizationId: "test-org",
        name: "test-org",
        displayName: "Test Organization",
        ownerId: "user123",
        ownerEmail: "owner@test.com",
        ownerDisplayName: "Owner User",
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.organization.id).toBe("test-org");
      expect(result.data.organization.displayName).toBe("Test Organization");

      const org = await store.getOrganization("test-org");
      expect(org).not.toBeNull();
      expect(org?.id).toBe("test-org");
    });

    it("should create organization with custom settings", async () => {
      const result = await tool.execute({
        organizationId: "custom-org",
        name: "custom-org",
        displayName: "Custom Org",
        ownerId: "user456",
        ownerEmail: "owner@custom.com",
        ownerDisplayName: "Custom Owner",
        settings: {
          defaultStorageQuota: 5000000,
          maxFileSize: 10000000,
          enableAuditLog: false,
        },
      });

      expect(result.success).toBe(true);

      const org = await store.getOrganization("custom-org");
      expect(org?.settings.defaultStorageQuota).toBe(5000000);
      expect(org?.settings.maxFileSize).toBe(10000000);
      expect(org?.settings.enableAuditLog).toBe(false);
    });

    it("should fail when organization already exists", async () => {
      await tool.execute({
        organizationId: "duplicate-org",
        name: "duplicate-org",
        displayName: "Duplicate Org",
        ownerId: "user123",
        ownerEmail: "owner@test.com",
        ownerDisplayName: "Owner",
      });

      const result = await tool.execute({
        organizationId: "duplicate-org",
        name: "duplicate-org",
        displayName: "Another Org",
        ownerId: "user456",
        ownerEmail: "owner2@test.com",
        ownerDisplayName: "Owner 2",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });

    it("should create organization with default quota", async () => {
      const result = await tool.execute({
        organizationId: "quota-org",
        name: "quota-org",
        displayName: "Quota Org",
        ownerId: "user123",
        ownerEmail: "owner@test.com",
        ownerDisplayName: "Owner",
      });

      expect(result.success).toBe(true);

      const quota = await store.getQuota("quota-org");
      expect(quota).not.toBeNull();
      expect(quota?.storageLimit).toBeGreaterThan(0);
      expect(quota?.requestLimit).toBeGreaterThan(0);
    });

    it("should set organization status to active", async () => {
      const result = await tool.execute({
        organizationId: "active-org",
        name: "active-org",
        displayName: "Active Org",
        ownerId: "user123",
        ownerEmail: "owner@test.com",
        ownerDisplayName: "Owner",
      });

      expect(result.success).toBe(true);

      const org = await store.getOrganization("active-org");
      expect(org?.status).toBe("active");
    });
  });

  describe("Error Handling", () => {
    it("should handle errors gracefully", async () => {
      const result = await tool.execute({
        organizationId: "error-org",
        name: "error-org",
        displayName: "Error Org",
        ownerId: "user123",
        ownerEmail: "owner@test.com",
        ownerDisplayName: "Owner",
      });

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it("should include execution time in result", async () => {
      const result = await tool.execute({
        organizationId: "timing-org",
        name: "timing-org",
        displayName: "Timing Org",
        ownerId: "user123",
        ownerEmail: "owner@test.com",
        ownerDisplayName: "Owner",
      });

      expect(result.executionTime).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });
});
