import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { UsageTracker, UsageEventType } from "../UsageTracker.js";
import { TenantStore } from "../../storage/TenantStore.js";
import { Logger } from "@lighthouse-tooling/shared";
import { TenantContext, Organization, Role } from "@lighthouse-tooling/types";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

describe("UsageTracker", () => {
  let tracker: UsageTracker;
  let store: TenantStore;
  let testDir: string;
  let logger: Logger;
  let testContext: TenantContext;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `usage-tracker-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    logger = Logger.getInstance({ level: "error", component: "UsageTrackerTest" });
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

    tracker = new UsageTracker({
      store,
      logger,
      enableTracking: true,
      batchSize: 5,
      flushInterval: 60000, // Long interval for testing
    });

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

    await store.saveOrganization(org);

    testContext = {
      organization: org,
      team: {
        id: "test-team",
        organizationId: "test-org",
        name: "test-team",
        displayName: "Test Team",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: "user123",
        members: [],
        status: "active",
      },
      user: {
        userId: "user123",
        email: "user@test.com",
        displayName: "Test User",
        role: Role.MEMBER,
        joinedAt: new Date().toISOString(),
        status: "active",
      },
      apiKey: {
        id: "key123",
        organizationId: "test-org",
        createdBy: "user123",
        name: "Test Key",
        key: "test-key",
        keyHash: "hash123",
        createdAt: new Date().toISOString(),
        status: "active",
      },
      permissions: [],
      quota: {
        storageLimit: 1000000,
        storageUsed: 0,
        requestLimit: 10000,
        requestsUsed: 0,
        bandwidthLimit: 5000000,
        bandwidthUsed: 0,
        maxTeams: 10,
        currentTeams: 1,
        maxMembersPerTeam: 50,
        maxApiKeys: 100,
        currentApiKeys: 1,
        resetDate: new Date().toISOString(),
      },
    };
  });

  afterEach(async () => {
    await tracker.stop();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe("Event Tracking", () => {
    it("should track usage event", async () => {
      await tracker.trackEvent(testContext, UsageEventType.FILE_UPLOAD, {
        toolName: "lighthouse-upload",
        resourceId: "file123",
        bytesTransferred: 1000,
        durationMs: 500,
        success: true,
      });

      // Force flush
      await tracker.flush();

      const auditLogs = await store.getAuditLogs("test-org", 10);
      expect(auditLogs.length).toBeGreaterThan(0);

      const log = auditLogs.find((l) => l.action === UsageEventType.FILE_UPLOAD);
      expect(log).toBeDefined();
      expect(log?.userId).toBe("user123");
      expect(log?.resource).toBe("lighthouse-upload");
      expect(log?.result).toBe("success");
    });

    it("should track file upload", async () => {
      await tracker.trackFileUpload(testContext, 1000, "file123", 500, true);
      await tracker.flush();

      const auditLogs = await store.getAuditLogs("test-org", 10);
      const log = auditLogs.find((l) => l.action === UsageEventType.FILE_UPLOAD);

      expect(log).toBeDefined();
      expect(log?.metadata?.bytesTransferred).toBe(1000);
      expect(log?.metadata?.durationMs).toBe(500);
    });

    it("should track file download", async () => {
      await tracker.trackFileDownload(testContext, 2000, "file456", 300, true);
      await tracker.flush();

      const auditLogs = await store.getAuditLogs("test-org", 10);
      const log = auditLogs.find((l) => l.action === UsageEventType.FILE_DOWNLOAD);

      expect(log).toBeDefined();
      expect(log?.metadata?.bytesTransferred).toBe(2000);
    });

    it("should track dataset creation", async () => {
      await tracker.trackDatasetCreate(testContext, "dataset123", 1000, true);
      await tracker.flush();

      const auditLogs = await store.getAuditLogs("test-org", 10);
      const log = auditLogs.find((l) => l.action === UsageEventType.DATASET_CREATE);

      expect(log).toBeDefined();
      expect(log?.resourceId).toBe("dataset123");
    });

    it("should track API call", async () => {
      await tracker.trackApiCall(testContext, "test-tool", 100, true, { foo: "bar" });
      await tracker.flush();

      const auditLogs = await store.getAuditLogs("test-org", 10);
      const log = auditLogs.find((l) => l.resource === "test-tool");

      expect(log).toBeDefined();
      expect(log?.metadata?.foo).toBe("bar");
    });

    it("should track failed events", async () => {
      await tracker.trackEvent(testContext, UsageEventType.FILE_UPLOAD, {
        toolName: "lighthouse-upload",
        success: false,
        durationMs: 100,
      });
      await tracker.flush();

      const auditLogs = await store.getAuditLogs("test-org", 10);
      const log = auditLogs.find((l) => l.action === UsageEventType.FILE_UPLOAD);

      expect(log?.result).toBe("failure");
    });
  });

  describe("Batch Processing", () => {
    it("should automatically flush when batch size reached", async () => {
      // Track 5 events (batch size is 5)
      for (let i = 0; i < 5; i++) {
        await tracker.trackApiCall(testContext, `tool-${i}`, 100, true);
      }

      // Should have auto-flushed
      const auditLogs = await store.getAuditLogs("test-org", 10);
      expect(auditLogs.length).toBe(5);
    });

    it("should queue events below batch size", async () => {
      // Track 3 events (below batch size of 5)
      for (let i = 0; i < 3; i++) {
        await tracker.trackApiCall(testContext, `tool-${i}`, 100, true);
      }

      // Should not have flushed yet
      let auditLogs = await store.getAuditLogs("test-org", 10);
      expect(auditLogs.length).toBe(0);

      // Manual flush
      await tracker.flush();

      auditLogs = await store.getAuditLogs("test-org", 10);
      expect(auditLogs.length).toBe(3);
    });
  });

  describe("Usage Summary", () => {
    beforeEach(async () => {
      // Add some usage events
      await tracker.trackFileUpload(testContext, 1000, "file1", 100, true);
      await tracker.trackFileUpload(testContext, 2000, "file2", 150, true);
      await tracker.trackFileDownload(testContext, 1500, "file3", 80, true);
      await tracker.trackDatasetCreate(testContext, "dataset1", 200, true);
      await tracker.trackApiCall(testContext, "tool1", 50, true);
      await tracker.trackApiCall(testContext, "tool2", 60, false);
      await tracker.flush();
    });

    it("should generate usage summary", async () => {
      const startDate = new Date(Date.now() - 3600000); // 1 hour ago
      const endDate = new Date(Date.now() + 3600000); // 1 hour from now

      const summary = await tracker.getUsageSummary("test-org", undefined, startDate, endDate);

      expect(summary.organizationId).toBe("test-org");
      expect(summary.totalRequests).toBeGreaterThan(0);
      expect(summary.successfulRequests).toBeGreaterThan(0);
      expect(summary.failedRequests).toBeGreaterThan(0);
    });

    it("should calculate total bytes uploaded", async () => {
      const startDate = new Date(Date.now() - 3600000);
      const endDate = new Date(Date.now() + 3600000);

      const summary = await tracker.getUsageSummary("test-org", undefined, startDate, endDate);

      expect(summary.totalBytesUploaded).toBe(3000); // 1000 + 2000
    });

    it("should calculate total bytes downloaded", async () => {
      const startDate = new Date(Date.now() - 3600000);
      const endDate = new Date(Date.now() + 3600000);

      const summary = await tracker.getUsageSummary("test-org", undefined, startDate, endDate);

      expect(summary.totalBytesDownloaded).toBe(1500);
    });

    it("should count events by type", async () => {
      const startDate = new Date(Date.now() - 3600000);
      const endDate = new Date(Date.now() + 3600000);

      const summary = await tracker.getUsageSummary("test-org", undefined, startDate, endDate);

      expect(summary.eventsByType[UsageEventType.FILE_UPLOAD]).toBe(2);
      expect(summary.eventsByType[UsageEventType.FILE_DOWNLOAD]).toBe(1);
      expect(summary.eventsByType[UsageEventType.DATASET_CREATE]).toBe(1);
      expect(summary.eventsByType[UsageEventType.API_CALL]).toBe(2);
    });

    it("should list top users", async () => {
      const startDate = new Date(Date.now() - 3600000);
      const endDate = new Date(Date.now() + 3600000);

      const summary = await tracker.getUsageSummary("test-org", undefined, startDate, endDate);

      expect(summary.topUsers.length).toBeGreaterThan(0);
      expect(summary.topUsers[0].userId).toBe("user123");
      expect(summary.topUsers[0].requestCount).toBeGreaterThan(0);
    });

    it("should list top tools", async () => {
      const startDate = new Date(Date.now() - 3600000);
      const endDate = new Date(Date.now() + 3600000);

      const summary = await tracker.getUsageSummary("test-org", undefined, startDate, endDate);

      expect(summary.topTools.length).toBeGreaterThan(0);
    });

    it("should filter by date range", async () => {
      const futureDate = new Date(Date.now() + 7200000); // 2 hours from now
      const summary = await tracker.getUsageSummary(
        "test-org",
        undefined,
        futureDate,
        new Date(Date.now() + 10800000), // 3 hours from now
      );

      expect(summary.totalRequests).toBe(0);
    });

    it("should filter by team ID", async () => {
      const startDate = new Date(Date.now() - 3600000);
      const endDate = new Date(Date.now() + 3600000);

      const summary = await tracker.getUsageSummary("test-org", "test-team", startDate, endDate);

      expect(summary.teamId).toBe("test-team");
    });
  });

  describe("Tracking Control", () => {
    it("should not track when disabled", async () => {
      const disabledTracker = new UsageTracker({
        store,
        logger,
        enableTracking: false,
      });

      await disabledTracker.trackApiCall(testContext, "test-tool", 100, true);
      await disabledTracker.flush();

      const auditLogs = await store.getAuditLogs("test-org", 10);
      expect(auditLogs.length).toBe(0);

      await disabledTracker.stop();
    });

    it("should flush remaining events on stop", async () => {
      await tracker.trackApiCall(testContext, "test-tool", 100, true);

      // Stop without manual flush
      await tracker.stop();

      const auditLogs = await store.getAuditLogs("test-org", 10);
      expect(auditLogs.length).toBeGreaterThan(0);
    });

    it("should handle flush errors gracefully", async () => {
      // Create a store that will fail
      const mockStore = {
        ...store,
        appendAuditLog: vi.fn().mockRejectedValue(new Error("Storage error")),
        getAuditLogs: vi.fn().mockResolvedValue([]),
      } as any;

      const errorTracker = new UsageTracker({
        store: mockStore,
        logger,
        enableTracking: true,
      });

      await errorTracker.trackApiCall(testContext, "test-tool", 100, true);

      // Should not throw
      await expect(errorTracker.flush()).resolves.not.toThrow();

      await errorTracker.stop();
    });
  });
});
