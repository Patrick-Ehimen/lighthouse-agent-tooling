import { EventEmitter } from "eventemitter3";
import {
  GeneratedKey,
  KeyShard,
  EncryptionOptions,
  AccessControlConfig,
  EncryptionResponse,
  AuthToken,
  ChainType,
  DecryptionType,
} from "../types";

// Import Kavach SDK methods
let kavach: any;
try {
  kavach = require("@lighthouse-web3/kavach");
} catch (error) {
  // Fallback imports from local encryption-sdk
  try {
    kavach = require("../../../../../lighthouse-ide/encryption-sdk/src/methods");
  } catch (fallbackError) {
    console.warn("Kavach SDK not found, encryption features will be disabled");
  }
}

/**
 * Manages encryption operations using Kavach SDK for threshold cryptography
 * and access control functionality.
 */
export class EncryptionManager extends EventEmitter {
  private isKavachAvailable: boolean;

  constructor() {
    super();
    this.isKavachAvailable = !!kavach;
  }

  /**
   * Check if encryption functionality is available
   */
  isAvailable(): boolean {
    return this.isKavachAvailable;
  }

  /**
   * Generate new encryption key with threshold cryptography
   *
   * @param threshold - Minimum number of shards needed for key recovery
   * @param keyCount - Total number of key shards to generate
   * @returns Generated master key and key shards
   */
  async generateKey(threshold: number = 3, keyCount: number = 5): Promise<GeneratedKey> {
    if (!this.isKavachAvailable) {
      throw new Error("Kavach SDK not available - encryption features disabled");
    }

    try {
      this.emit("key:generation:start", { threshold, keyCount });

      const result = await kavach.generate(threshold, keyCount);

      if (!result || !result.keyShards) {
        throw new Error("Failed to generate encryption key");
      }

      this.emit("key:generation:success", result);
      return result;
    } catch (error) {
      this.emit("key:generation:error", error);
      throw new Error(
        `Key generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Create key shards from an existing master key
   *
   * @param masterKey - Existing master key to shard
   * @param threshold - Minimum number of shards needed for key recovery
   * @param keyCount - Total number of key shards to generate
   * @returns Generated key shards
   */
  async shardKey(
    masterKey: string,
    threshold: number = 3,
    keyCount: number = 5,
  ): Promise<{ keyShards: KeyShard[] }> {
    if (!this.isKavachAvailable) {
      throw new Error("Kavach SDK not available - encryption features disabled");
    }

    try {
      this.emit("key:sharding:start", { masterKey: "***", threshold, keyCount });

      const result = await kavach.shardKey(masterKey, threshold, keyCount);

      if (!result || !result.isShardable || !result.keyShards) {
        throw new Error("Failed to shard encryption key");
      }

      this.emit("key:sharding:success", { keyShards: result.keyShards });
      return { keyShards: result.keyShards };
    } catch (error) {
      this.emit("key:sharding:error", error);
      throw new Error(
        `Key sharding failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Save key shards to Lighthouse nodes for threshold access
   *
   * @param address - Wallet address of the file owner
   * @param cid - Content identifier of the file
   * @param authToken - Authentication token
   * @param keyShards - Key shards to save
   * @param sharedTo - Addresses to share access with
   * @returns Success status
   */
  async saveKeyShards(
    address: string,
    cid: string,
    authToken: AuthToken,
    keyShards: KeyShard[],
    sharedTo: string[] = [],
  ): Promise<EncryptionResponse> {
    if (!this.isKavachAvailable) {
      throw new Error("Kavach SDK not available - encryption features disabled");
    }

    try {
      this.emit("shards:save:start", { address, cid, shardsCount: keyShards.length });

      const result = await kavach.saveShards(address, cid, authToken, keyShards, sharedTo);

      if (!result) {
        throw new Error("Failed to save key shards");
      }

      this.emit("shards:save:success", result);
      return {
        isSuccess: result.isSuccess,
        error: result.error,
      };
    } catch (error) {
      this.emit("shards:save:error", error);
      return {
        isSuccess: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Set up access control conditions for encrypted files
   *
   * @param config - Access control configuration
   * @param authToken - Authentication token
   * @returns Success status
   */
  async setupAccessControl(
    config: AccessControlConfig,
    authToken: AuthToken,
  ): Promise<EncryptionResponse> {
    if (!this.isKavachAvailable) {
      throw new Error("Kavach SDK not available - encryption features disabled");
    }

    try {
      this.emit("access:control:start", {
        address: config.address,
        cid: config.cid,
        conditionsCount: config.conditions.length,
      });

      const result = await kavach.accessControl(
        config.address,
        config.cid,
        authToken,
        config.conditions,
        config.aggregator,
        config.chainType || "evm",
        config.keyShards || [],
        config.decryptionType || "ADDRESS",
      );

      if (!result) {
        throw new Error("Failed to set up access control");
      }

      this.emit("access:control:success", result);
      return {
        isSuccess: result.isSuccess,
        error: result.error,
      };
    } catch (error) {
      this.emit("access:control:error", error);
      return {
        isSuccess: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Recover master key from key shards
   *
   * @param keyShards - Array of key shards (minimum threshold required)
   * @returns Recovered master key
   */
  async recoverKey(
    keyShards: KeyShard[],
  ): Promise<{ masterKey: string | null; error: string | null }> {
    if (!this.isKavachAvailable) {
      throw new Error("Kavach SDK not available - encryption features disabled");
    }

    try {
      this.emit("key:recovery:start", { shardsCount: keyShards.length });

      const result = await kavach.recoverKey(keyShards);

      if (!result) {
        throw new Error("Failed to recover master key");
      }

      this.emit("key:recovery:success", { hasKey: !!result.masterKey });
      return result;
    } catch (error) {
      this.emit("key:recovery:error", error);
      return {
        masterKey: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get authentication message for wallet signing
   *
   * @param address - Wallet address
   * @returns Authentication message to be signed
   */
  async getAuthMessage(address: string): Promise<{ message: string | null; error: string | null }> {
    if (!this.isKavachAvailable) {
      throw new Error("Kavach SDK not available - encryption features disabled");
    }

    try {
      const result = await kavach.getAuthMessage(address);
      return result;
    } catch (error) {
      return {
        message: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Generate JWT token from signed message
   *
   * @param address - Wallet address
   * @param signedMessage - Signed authentication message
   * @returns JWT token
   */
  async getJWT(address: string, signedMessage: string): Promise<string | null> {
    if (!this.isKavachAvailable) {
      throw new Error("Kavach SDK not available - encryption features disabled");
    }

    try {
      const result = await kavach.getJWT(address, signedMessage);
      return result;
    } catch (error) {
      throw new Error(
        `JWT generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Share file access to additional addresses
   *
   * @param cid - File CID
   * @param address - File owner address
   * @param shareToAddress - Address to share with
   * @param authToken - Authentication token
   * @returns Success status
   */
  async shareToAddress(
    cid: string,
    address: string,
    shareToAddress: string,
    authToken: AuthToken,
  ): Promise<EncryptionResponse> {
    if (!this.isKavachAvailable) {
      throw new Error("Kavach SDK not available - encryption features disabled");
    }

    try {
      this.emit("access:share:start", { cid, address, shareToAddress });

      const result = await kavach.shareToAddress(cid, address, shareToAddress, authToken);

      this.emit("access:share:success", result);
      return {
        isSuccess: result?.isSuccess || false,
        error: result?.error || null,
      };
    } catch (error) {
      this.emit("access:share:error", error);
      return {
        isSuccess: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.removeAllListeners();
  }
}
