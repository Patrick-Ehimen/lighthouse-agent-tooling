import { EncryptionManager } from "../encryption/EncryptionManager";
import { KeyShard, AccessControlConfig } from "../types";

// Mock the Kavach SDK
const mockKavach = {
  generate: jest.fn(),
  shardKey: jest.fn(),
  saveShards: jest.fn(),
  accessControl: jest.fn(),
  recoverKey: jest.fn(),
  getAuthMessage: jest.fn(),
  getJWT: jest.fn(),
  shareToAddress: jest.fn(),
};

jest.mock("@lighthouse-web3/kavach", () => mockKavach, { virtual: true });
jest.mock("../../../../../lighthouse-ide/encryption-sdk/src/methods", () => mockKavach, {
  virtual: true,
});

describe("EncryptionManager", () => {
  let encryptionManager: EncryptionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    encryptionManager = new EncryptionManager();
  });

  afterEach(() => {
    encryptionManager.destroy();
  });

  describe("generateKey", () => {
    it("should generate encryption key with default parameters", async () => {
      const mockResult = {
        masterKey: "mock-master-key",
        keyShards: [
          { key: "shard1", index: "index1" },
          { key: "shard2", index: "index2" },
        ],
      };
      mockKavach.generate.mockResolvedValue(mockResult);

      const result = await encryptionManager.generateKey();

      expect(mockKavach.generate).toHaveBeenCalledWith(3, 5);
      expect(result).toEqual(mockResult);
    });

    it("should generate encryption key with custom parameters", async () => {
      const mockResult = {
        masterKey: "mock-master-key",
        keyShards: [
          { key: "shard1", index: "index1" },
          { key: "shard2", index: "index2" },
          { key: "shard3", index: "index3" },
        ],
      };
      mockKavach.generate.mockResolvedValue(mockResult);

      const result = await encryptionManager.generateKey(2, 3);

      expect(mockKavach.generate).toHaveBeenCalledWith(2, 3);
      expect(result).toEqual(mockResult);
    });

    it("should throw error when Kavach SDK is not available", async () => {
      const encryptionManagerWithoutKavach = new (class extends EncryptionManager {
        constructor() {
          super();
          (this as any).isKavachAvailable = false;
        }
      })();

      await expect(encryptionManagerWithoutKavach.generateKey()).rejects.toThrow(
        "Kavach SDK not available - encryption features disabled",
      );
    });

    it("should emit events during key generation", async () => {
      const mockResult = {
        masterKey: "mock-master-key",
        keyShards: [{ key: "shard1", index: "index1" }],
      };
      mockKavach.generate.mockResolvedValue(mockResult);

      const startSpy = jest.fn();
      const successSpy = jest.fn();

      encryptionManager.on("key:generation:start", startSpy);
      encryptionManager.on("key:generation:success", successSpy);

      await encryptionManager.generateKey(3, 5);

      expect(startSpy).toHaveBeenCalledWith({ threshold: 3, keyCount: 5 });
      expect(successSpy).toHaveBeenCalledWith(mockResult);
    });
  });

  describe("shardKey", () => {
    it("should shard existing key", async () => {
      const mockResult = {
        isShardable: true,
        keyShards: [
          { key: "shard1", index: "index1" },
          { key: "shard2", index: "index2" },
        ],
      };
      mockKavach.shardKey.mockResolvedValue(mockResult);

      const masterKey = "existing-master-key";
      const result = await encryptionManager.shardKey(masterKey, 2, 3);

      expect(mockKavach.shardKey).toHaveBeenCalledWith(masterKey, 2, 3);
      expect(result).toEqual({ keyShards: mockResult.keyShards });
    });

    it("should throw error when key is not shardable", async () => {
      const mockResult = {
        isShardable: false,
        keyShards: [],
      };
      mockKavach.shardKey.mockResolvedValue(mockResult);

      await expect(encryptionManager.shardKey("bad-key")).rejects.toThrow(
        "Failed to shard encryption key",
      );
    });
  });

  describe("setupAccessControl", () => {
    it("should set up access control with valid configuration", async () => {
      const mockResult = { isSuccess: true, error: null };
      mockKavach.accessControl.mockResolvedValue(mockResult);

      const config: AccessControlConfig = {
        address: "0x123",
        cid: "QmTest",
        conditions: [
          {
            id: 1,
            chain: "ethereum",
            method: "balanceOf",
            standardContractType: "ERC20",
            contractAddress: "0x456",
            returnValueTest: { comparator: ">=", value: "1000" },
            parameters: ["0x123"],
          },
        ],
        aggregator: "AND",
        chainType: "evm",
      };

      const result = await encryptionManager.setupAccessControl(config, "jwt-token");

      expect(mockKavach.accessControl).toHaveBeenCalledWith(
        config.address,
        config.cid,
        "jwt-token",
        config.conditions,
        config.aggregator,
        "evm",
        [],
        "ADDRESS",
      );
      expect(result).toEqual({ isSuccess: true, error: null });
    });

    it("should handle access control setup failure", async () => {
      const mockResult = { isSuccess: false, error: "Setup failed" };
      mockKavach.accessControl.mockResolvedValue(mockResult);

      const config: AccessControlConfig = {
        address: "0x123",
        cid: "QmTest",
        conditions: [],
      };

      const result = await encryptionManager.setupAccessControl(config, "jwt-token");

      expect(result).toEqual({ isSuccess: false, error: "Setup failed" });
    });
  });

  describe("recoverKey", () => {
    it("should recover master key from shards", async () => {
      const mockResult = { masterKey: "recovered-key", error: null };
      mockKavach.recoverKey.mockResolvedValue(mockResult);

      const keyShards: KeyShard[] = [
        { key: "shard1", index: "index1" },
        { key: "shard2", index: "index2" },
        { key: "shard3", index: "index3" },
      ];

      const result = await encryptionManager.recoverKey(keyShards);

      expect(mockKavach.recoverKey).toHaveBeenCalledWith(keyShards);
      expect(result).toEqual(mockResult);
    });

    it("should handle key recovery failure", async () => {
      mockKavach.recoverKey.mockRejectedValue(new Error("Recovery failed"));

      const keyShards: KeyShard[] = [{ key: "shard1", index: "index1" }];

      const result = await encryptionManager.recoverKey(keyShards);

      expect(result).toEqual({
        masterKey: null,
        error: "Recovery failed",
      });
    });
  });

  describe("shareToAddress", () => {
    it("should share access to another address", async () => {
      const mockResult = { isSuccess: true, error: null };
      mockKavach.shareToAddress.mockResolvedValue(mockResult);

      const result = await encryptionManager.shareToAddress(
        "QmTest",
        "0x123",
        "0x456",
        "jwt-token",
      );

      expect(mockKavach.shareToAddress).toHaveBeenCalledWith(
        "QmTest",
        "0x123",
        "0x456",
        "jwt-token",
      );
      expect(result).toEqual({ isSuccess: true, error: null });
    });
  });

  describe("getAuthMessage and getJWT", () => {
    it("should get auth message for signing", async () => {
      const mockResult = { message: "Sign this message", error: null };
      mockKavach.getAuthMessage.mockResolvedValue(mockResult);

      const result = await encryptionManager.getAuthMessage("0x123");

      expect(mockKavach.getAuthMessage).toHaveBeenCalledWith("0x123");
      expect(result).toEqual(mockResult);
    });

    it("should generate JWT from signed message", async () => {
      const mockResult = "jwt:token";
      mockKavach.getJWT.mockResolvedValue(mockResult);

      const result = await encryptionManager.getJWT("0x123", "signed-message");

      expect(mockKavach.getJWT).toHaveBeenCalledWith("0x123", "signed-message");
      expect(result).toEqual(mockResult);
    });
  });

  describe("isAvailable", () => {
    it("should return true when Kavach SDK is available", () => {
      expect(encryptionManager.isAvailable()).toBe(true);
    });

    it("should return false when Kavach SDK is not available", () => {
      const encryptionManagerWithoutKavach = new (class extends EncryptionManager {
        constructor() {
          super();
          (this as any).isKavachAvailable = false;
        }
      })();

      expect(encryptionManagerWithoutKavach.isAvailable()).toBe(false);
    });
  });
});
