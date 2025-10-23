/**
 * Example test file demonstrating testing patterns and utilities
 */

import {
  createMockUploadResult,
  createMockDataset,
  createMockProgressUpdate,
  SAMPLE_CIDS,
  SAMPLE_UPLOAD_RESULTS,
  wait,
  waitFor,
  expectToThrow,
  generateTestData,
  mockTimers,
} from "../src/test-utils";

// Import custom matchers
import "../src/test-utils/matchers";

describe("Test Utilities", () => {
  describe("Mock Factories", () => {
    it("should create valid mock upload result", () => {
      const mockResult = createMockUploadResult();

      expect(mockResult).toBeValidUploadResult();
      expect(mockResult.cid).toBeValidCID();
      expect(mockResult.uploadTime).toHaveValidTimestamp();
    });

    it("should create mock upload result with overrides", () => {
      const mockResult = createMockUploadResult({
        size: 2048,
        encrypted: true,
        tags: ["custom", "test"],
      });

      expect(mockResult.size).toBe(2048);
      expect(mockResult.encrypted).toBe(true);
      expect(mockResult.tags).toEqual(["custom", "test"]);
    });

    it("should create valid mock dataset", () => {
      const mockDataset = createMockDataset();

      expect(mockDataset).toBeValidDataset();
      expect(mockDataset.files).toHaveLength(1);
      expect(mockDataset.files[0]).toBeValidUploadResult();
    });

    it("should create valid progress update", () => {
      const mockProgress = createMockProgressUpdate({
        progress: 75,
        stage: "processing",
      });

      expect(mockProgress).toMatchProgressUpdate();
      expect(mockProgress.progress).toBe(75);
      expect(mockProgress.stage).toBe("processing");
    });
  });

  describe("Fixtures", () => {
    it("should provide valid sample CIDs", () => {
      SAMPLE_CIDS.valid.forEach((cid) => {
        expect(cid).toBeValidCID();
      });
    });

    it("should provide invalid CIDs for negative testing", () => {
      SAMPLE_CIDS.invalid.forEach((cid) => {
        expect(cid).not.toBeValidCID();
      });
    });

    it("should provide valid sample upload results", () => {
      Object.values(SAMPLE_UPLOAD_RESULTS).forEach((result) => {
        expect(result).toBeValidUploadResult();
      });
    });
  });

  describe("Helper Functions", () => {
    it("should wait for specified time", async () => {
      const start = Date.now();
      await wait(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });

    it("should wait for condition to be true", async () => {
      let counter = 0;
      const condition = () => {
        counter++;
        return counter >= 3;
      };

      await waitFor(condition, 1000, 50);
      expect(counter).toBe(3);
    });

    it("should timeout when condition is never met", async () => {
      const condition = () => false;

      await expectToThrow(() => waitFor(condition, 100, 10), "Condition not met within 100ms");
    });

    it("should generate random test data", () => {
      const randomString = generateTestData.string(10);
      const randomNumber = generateTestData.number(1, 10);
      const randomBoolean = generateTestData.boolean();
      const randomArray = generateTestData.array(() => "item", 3);
      const randomCid = generateTestData.cid();

      expect(randomString).toHaveLength(10);
      expect(randomNumber).toBeGreaterThanOrEqual(1);
      expect(randomNumber).toBeLessThanOrEqual(10);
      expect(typeof randomBoolean).toBe("boolean");
      expect(randomArray).toHaveLength(3);
      expect(randomCid).toBeValidCID();
    });
  });

  describe("Timer Utilities", () => {
    beforeEach(() => {
      mockTimers.setup();
    });

    afterEach(() => {
      mockTimers.teardown();
    });

    it("should work with fake timers", () => {
      const callback = jest.fn();

      setTimeout(callback, 1000);
      expect(callback).not.toHaveBeenCalled();

      mockTimers.advanceBy(1000);
      expect(callback).toHaveBeenCalled();
    });
  });

  describe("Error Testing", () => {
    it("should test function that throws error", async () => {
      const errorFunction = () => {
        throw new Error("Test error message");
      };

      const error = await expectToThrow(errorFunction, "Test error message");
      expect(error.message).toBe("Test error message");
    });

    it("should test async function that throws error", async () => {
      const asyncErrorFunction = async () => {
        throw new Error("Async test error");
      };

      await expectToThrow(asyncErrorFunction, /Async test error/);
    });
  });
});
