/**
 * Mock CID Generator - Generates realistic IPFS CIDs for testing
 */

import * as crypto from "crypto";

export class CIDGenerator {
  /**
   * Generate a mock CIDv0 (starts with Qm, 46 characters, base58)
   */
  static generateV0(input: string): string {
    // Create a hash of the input
    const hash = crypto.createHash("sha256").update(input).digest("hex");

    // Convert to base58-like string (simplified)
    const base58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let result = "Qm";

    // Use hash to generate 44 base58 characters
    for (let i = 0; i < 44; i++) {
      const charIndex = i * 2;
      const hexValue = hash.substring(charIndex, Math.min(charIndex + 2, hash.length));
      if (hexValue.length === 2) {
        const index = parseInt(hexValue, 16) % base58Chars.length;
        result += base58Chars[index];
      } else {
        // Fallback if hash is too short
        result += base58Chars[i % base58Chars.length];
      }
    }

    return result;
  }

  /**
   * Generate a mock CIDv1 (starts with b, variable length, base32)
   */
  static generateV1(input: string): string {
    const hash = crypto.createHash("sha256").update(input).digest("hex");

    // Convert to base32-like string (simplified)
    const base32Chars = "abcdefghijklmnopqrstuvwxyz234567";
    let result = "b";

    // Use hash to generate base32 string
    for (let i = 0; i < 52; i++) {
      const index = parseInt(hash.substring(i % hash.length), 16) % base32Chars.length;
      result += base32Chars[index];
    }

    return result;
  }

  /**
   * Generate a mock CID based on file path and timestamp
   */
  static generate(filePath: string, useV1 = false): string {
    const timestamp = Date.now().toString();
    const input = `${filePath}-${timestamp}`;

    return useV1 ? this.generateV1(input) : this.generateV0(input);
  }

  /**
   * Validate CID format
   */
  static isValid(cid: string): boolean {
    // CIDv0: starts with Qm, 46 characters
    const cidv0Pattern = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;

    // CIDv1: starts with b, variable length
    const cidv1Pattern = /^b[a-z2-7]+$/;

    return cidv0Pattern.test(cid) || cidv1Pattern.test(cid);
  }
}
