import { LighthouseAISDK } from "../LighthouseAISDK";
import { LighthouseConfig } from "../types";

// Mock the lighthouse SDK
jest.mock("@lighthouse-web3/sdk", () => ({
  upload: jest.fn(),
  download: jest.fn(),
  getFileStatus: jest.fn(),
  getUploads: jest.fn(),
}));

// Mock fs promises
jest.mock("fs", () => ({
  promises: {
    stat: jest.fn(),
  },
}));

describe("LighthouseAISDK", () => {
  let sdk: LighthouseAISDK;
  let config: LighthouseConfig;

  beforeEach(() => {
    config = {
      apiKey: "test-api-key",
      baseUrl: "https://test.lighthouse.storage",
      timeout: 30000,
      maxRetries: 3,
      debug: false,
    };

    sdk = new LighthouseAISDK(config);
  });

  afterEach(() => {
    sdk.destroy();
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create SDK instance with config", () => {
      expect(sdk).toBeInstanceOf(LighthouseAISDK);
    });

    it("should initialize auth and progress managers", () => {
      expect(sdk.getAuthState()).toBeDefined();
      expect(sdk.getActiveOperations()).toEqual([]);
    });
  });

  describe("initialize", () => {
    it("should authenticate on initialization", async () => {
      // Mock successful authentication
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            accessToken: "test-token",
            expiresIn: 3600,
          }),
      });

      await sdk.initialize();

      const authState = sdk.getAuthState();
      expect(authState.isAuthenticated).toBe(true);
      expect(authState.accessToken).toBe("test-token");
    });

    it("should throw error on authentication failure", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () => Promise.resolve({ message: "Invalid API key" }),
      });

      await expect(sdk.initialize()).rejects.toThrow("Authentication failed");
    });
  });

  describe("uploadFile", () => {
    beforeEach(() => {
      // Mock successful authentication
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            accessToken: "test-token",
            expiresIn: 3600,
          }),
      });
    });

    it("should upload file successfully", async () => {
      const lighthouse = require("@lighthouse-web3/sdk");
      const fs = require("fs");

      // Mock file stats
      fs.promises.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
        mtime: new Date(),
      });

      // Mock lighthouse upload
      lighthouse.upload.mockResolvedValue({
        data: {
          Hash: "QmTestHash123",
          Size: 1024,
        },
      });

      const result = await sdk.uploadFile("/test/file.txt", {
        fileName: "test-file.txt",
        mimeType: "text/plain",
      });

      expect(result).toEqual({
        hash: "QmTestHash123",
        name: "test-file.txt",
        size: 1024,
        mimeType: "text/plain",
        uploadedAt: expect.any(Date),
        encrypted: false,
      });

      expect(lighthouse.upload).toHaveBeenCalledWith(
        "/test/file.txt",
        "test-token",
        false,
        undefined,
        expect.any(Function)
      );
    });

    it("should handle file not found error", async () => {
      const fs = require("fs");

      fs.promises.stat.mockRejectedValue({
        code: "ENOENT",
      });

      await expect(sdk.uploadFile("/nonexistent/file.txt")).rejects.toThrow(
        "File not found"
      );
    });

    it("should emit progress events during upload", async () => {
      const lighthouse = require("@lighthouse-web3/sdk");
      const fs = require("fs");

      fs.promises.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
        mtime: new Date(),
      });

      lighthouse.upload.mockImplementation(
        (path, token, deal, end, progressCallback) => {
          // Simulate progress updates synchronously
          if (progressCallback) {
            progressCallback({ loaded: 512, total: 1024 });
            progressCallback({ loaded: 1024, total: 1024 });
          }

          return Promise.resolve({
            data: { Hash: "QmTestHash123", Size: 1024 },
          });
        }
      );

      const progressEvents: any[] = [];
      sdk.on("upload:progress", (event) => progressEvents.push(event));

      await sdk.uploadFile("/test/file.txt");

      expect(progressEvents.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe("getAuthState", () => {
    it("should return current authentication state", () => {
      const authState = sdk.getAuthState();

      expect(authState).toHaveProperty("accessToken");
      expect(authState).toHaveProperty("expiresAt");
      expect(authState).toHaveProperty("isAuthenticated");
      expect(authState).toHaveProperty("lastError");
    });
  });

  describe("destroy", () => {
    it("should cleanup resources", () => {
      const removeAllListenersSpy = jest.spyOn(sdk, "removeAllListeners");

      sdk.destroy();

      expect(removeAllListenersSpy).toHaveBeenCalled();
    });
  });
});
