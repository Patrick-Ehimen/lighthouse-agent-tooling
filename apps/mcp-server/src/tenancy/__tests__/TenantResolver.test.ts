import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TenantResolver } from "../TenantResolver.js";
import { TenantStore } from "../storage/TenantStore.js";
import { Logger } from "@lighthouse-tooling/shared";
import { Organization, Team, TenantApiKey, Role } from "@lighthouse-tooling/types";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

describe("TenantResolver", () => {
  let resolver: TenantResolver;
  let store: TenantStore;
  let testDir: string;
  let logger: Logger;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `tenant-resolver-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    logger = Logger.getInstance({ level: "error", component: "TenantResolverTest" });
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

    resolver = new TenantResolver({
      store,
      logger,
      defaultOrganizationId: "default",
      strictIsolation: true,
    });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe("API Key Parsing", () => {
    it("should parse organization-only format", () => {
      const key = "org_acme_key_abc123.secret123";
      const parsed = resolver.parseApiKey(key);

      expect(parsed.organizationId).toBe("acme");
      expect(parsed.teamId).toBeUndefined();
      expect(parsed.keyId).toBe("abc123");
      expect(parsed.secret).toBe("secret123");
      expect(parsed.isLegacy).toBe(false);
    });

    it("should parse legacy format", () => {
      const key = "dc3a5d70.44c9afa688264dd88fe922d4b048f9c2";
      const parsed = resolver.parseApiKey(key);

      expect(parsed.organizationId).toBe("default");
      expect(parsed.isLegacy).toBe(true);
    });
  });

  describe("Tenant Resolution", () => {
    it("should fail for non-existent organization", async () => {
      const result = await resolver.resolveTenant("org_nonexistent_key_abc.secret");

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("ORGANIZATION_NOT_FOUND");
    });

    it("should resolve with complete tenant structure", async () => {
      const org: Organization = {
        id: "test-org",
        name: "test-org",
        displayName: "Test Org",
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

      const team: Team = {
        id: "test-team",
        organizationId: "test-org",
        name: "test-team",
        displayName: "Test Team",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: "user123",
        members: [
          {
            userId: "user123",
            email: "user@test.com",
            displayName: "Test User",
            role: Role.OWNER,
            joinedAt: new Date().toISOString(),
            status: "active",
          },
        ],
        status: "active",
      };

      const apiKey: TenantApiKey = {
        id: "key123",
        organizationId: "test-org",
        teamId: "test-team",
        createdBy: "user123",
        name: "Test Key",
        key: "org_test-org_key_key123.secret",
        keyHash: "hash123",
        createdAt: new Date().toISOString(),
        status: "active",
      };

      const quota = {
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
      };

      await store.saveOrganization(org);
      await store.saveTeam("test-org", team);
      await store.saveApiKey("test-org", apiKey);
      await store.saveQuota("test-org", quota);

      const result = await resolver.resolveTenant("org_test-org_key_key123.secret");

      expect(result.success).toBe(true);
      expect(result.context?.organization.id).toBe("test-org");
      expect(result.context?.user.userId).toBe("user123");
      expect(result.context?.permissions).toBeDefined();
      expect(result.context?.permissions.length).toBeGreaterThan(0);
    });
  });
});
