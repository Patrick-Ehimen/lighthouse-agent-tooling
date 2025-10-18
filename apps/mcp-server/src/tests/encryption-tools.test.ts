/**
 * Integration tests for encryption MCP tools
 */

import { vi } from "vitest";
import { LighthouseGenerateKeyTool } from "../tools/LighthouseGenerateKeyTool.js";
import { LighthouseSetupAccessControlTool } from "../tools/LighthouseSetupAccessControlTool.js";
import { MockLighthouseService } from "../services/MockLighthouseService.js";
import { Logger } from "@lighthouse-tooling/shared";

describe("Encryption MCP Tools Integration", () => {
  let mockService: MockLighthouseService;
  let logger: Logger;

  beforeEach(() => {
    mockService = new MockLighthouseService();
    logger = Logger.getInstance({ level: "error", component: "Test" }); // Use error level to minimize test output
  });

  afterEach(() => {
    mockService.clear();
  });

  describe("LighthouseGenerateKeyTool", () => {
    let generateKeyTool: LighthouseGenerateKeyTool;

    beforeEach(() => {
      generateKeyTool = new LighthouseGenerateKeyTool(mockService, logger);
    });

    it("should have correct tool definition", () => {
      const definition = LighthouseGenerateKeyTool.getDefinition();

      expect(definition.name).toBe("lighthouse_generate_key");
      expect(definition.description).toContain("threshold cryptography");
      expect(definition.requiresAuth).toBe(false);
      expect(definition.inputSchema.properties.threshold).toBeDefined();
      expect(definition.inputSchema.properties.keyCount).toBeDefined();
    });

    it("should generate key with default parameters", async () => {
      // Mock the encryption key generation
      const mockKeyData = {
        masterKey: "test-master-key",
        keyShards: [
          { key: "shard1", index: "index1" },
          { key: "shard2", index: "index2" },
          { key: "shard3", index: "index3" },
        ],
      };

      vi.spyOn(mockService, "generateEncryptionKey").mockResolvedValue({
        success: true,
        data: mockKeyData,
      });

      const result = await generateKeyTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as any).keyShards).toHaveLength(3);
      expect((result.data as any).threshold).toBe(3);
      expect((result.data as any).keyCount).toBe(5);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it("should generate key with custom parameters", async () => {
      const mockKeyData = {
        masterKey: "test-master-key",
        keyShards: [
          { key: "shard1", index: "index1" },
          { key: "shard2", index: "index2" },
        ],
      };

      vi.spyOn(mockService, "generateEncryptionKey").mockResolvedValue({
        success: true,
        data: mockKeyData,
      });

      const result = await generateKeyTool.execute({
        threshold: 2,
        keyCount: 3,
      });

      expect(result.success).toBe(true);
      expect((result.data as any).threshold).toBe(2);
      expect((result.data as any).keyCount).toBe(3);
    });

    it("should handle invalid parameters", async () => {
      const result = await generateKeyTool.execute({
        threshold: 10, // Too high
        keyCount: 2, // Lower than threshold
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("keyCount must be an integer between 3 and 15");
    });

    it("should handle service errors gracefully", async () => {
      vi.spyOn(mockService, "generateEncryptionKey").mockResolvedValue({
        success: false,
        error: "Key generation failed",
      });

      const result = await generateKeyTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("Key generation failed");
    });
  });

  describe("LighthouseSetupAccessControlTool", () => {
    let setupAccessControlTool: LighthouseSetupAccessControlTool;

    beforeEach(() => {
      setupAccessControlTool = new LighthouseSetupAccessControlTool(mockService, logger);
    });

    it("should have correct tool definition", () => {
      const definition = LighthouseSetupAccessControlTool.getDefinition();

      expect(definition.name).toBe("lighthouse_setup_access_control");
      expect(definition.description).toContain("access control conditions");
      expect(definition.requiresAuth).toBe(true);
      expect(definition.inputSchema.properties.address).toBeDefined();
      expect(definition.inputSchema.properties.cid).toBeDefined();
      expect(definition.inputSchema.properties.conditions).toBeDefined();
      expect(definition.inputSchema.properties.authToken).toBeDefined();
    });

    it("should setup access control with valid parameters", async () => {
      vi.spyOn(mockService, "setupAccessControl").mockResolvedValue({
        success: true,
      });

      const result = await setupAccessControlTool.execute({
        address: "0x1234567890abcdef",
        cid: "QmTestHash123",
        conditions: [
          {
            id: 1,
            chain: "ethereum",
            method: "balanceOf",
            standardContractType: "ERC20",
            contractAddress: "0xabcdef1234567890",
            returnValueTest: {
              comparator: ">=",
              value: "1000000000000000000", // 1 ETH in wei
            },
            parameters: ["0x1234567890abcdef"],
          },
        ],
        authToken: "jwt:test-token",
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as any).address).toBe("0x1234567890abcdef");
      expect((result.data as any).cid).toBe("QmTestHash123");
    });

    it("should handle missing required parameters", async () => {
      const result = await setupAccessControlTool.execute({
        address: "0x1234567890abcdef",
        // Missing cid, conditions, and authToken
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid parameters");
    });

    it("should validate condition structure", async () => {
      const result = await setupAccessControlTool.execute({
        address: "0x1234567890abcdef",
        cid: "QmTestHash123",
        conditions: [
          {
            // Missing required fields
            id: 1,
            chain: "ethereum",
            // Missing method and returnValueTest
          },
        ],
        authToken: "jwt:test-token",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid parameters");
    });

    it("should handle service errors", async () => {
      vi.spyOn(mockService, "setupAccessControl").mockResolvedValue({
        success: false,
        error: "Access control setup failed",
      });

      const result = await setupAccessControlTool.execute({
        address: "0x1234567890abcdef",
        cid: "QmTestHash123",
        conditions: [
          {
            id: 1,
            chain: "ethereum",
            method: "balanceOf",
            returnValueTest: { comparator: ">=", value: "1000" },
          },
        ],
        authToken: "jwt:test-token",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access control setup failed");
    });

    it("should support different chain types", async () => {
      vi.spyOn(mockService, "setupAccessControl").mockResolvedValue({
        success: true,
      });

      const result = await setupAccessControlTool.execute({
        address: "0x1234567890abcdef",
        cid: "QmTestHash123",
        conditions: [
          {
            id: 1,
            chain: "solana",
            method: "getAccountInfo",
            standardContractType: "spl-token",
            returnValueTest: { comparator: ">=", value: "1000000" },
          },
        ],
        chainType: "solana",
        authToken: "jwt:test-token",
      });

      expect(result.success).toBe(true);
      expect((result.data as any).chainType).toBe("solana");
    });
  });

  describe("Tool Integration", () => {
    it("should work together for complete encryption workflow", async () => {
      const generateKeyTool = new LighthouseGenerateKeyTool(mockService, logger);
      const setupAccessControlTool = new LighthouseSetupAccessControlTool(mockService, logger);

      // Step 1: Generate encryption key
      const mockKeyData = {
        masterKey: "test-master-key",
        keyShards: [
          { key: "shard1", index: "index1" },
          { key: "shard2", index: "index2" },
          { key: "shard3", index: "index3" },
        ],
      };

      vi.spyOn(mockService, "generateEncryptionKey").mockResolvedValue({
        success: true,
        data: mockKeyData,
      });

      const keyResult = await generateKeyTool.execute({
        threshold: 2,
        keyCount: 3,
      });

      expect(keyResult.success).toBe(true);
      const keyShards = (keyResult.data as any).keyShards.map((shard: any) => ({
        key: shard.shard,
        index: shard.index,
      }));

      // Step 2: Setup access control with generated key shards
      vi.spyOn(mockService, "setupAccessControl").mockResolvedValue({
        success: true,
      });

      const accessControlResult = await setupAccessControlTool.execute({
        address: "0x1234567890abcdef",
        cid: "QmTestHash123",
        conditions: [
          {
            id: 1,
            chain: "ethereum",
            method: "balanceOf",
            returnValueTest: { comparator: ">=", value: "1000" },
          },
        ],
        keyShards: keyShards,
        authToken: "jwt:test-token",
      });

      expect(accessControlResult.success).toBe(true);
    });
  });
});
