import { ErrorHandler } from "../errors/ErrorHandler";
import {
  NetworkError,
  AuthenticationError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from "../errors/errors";

describe("ErrorHandler", () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler({
      maxRetries: 2,
      baseDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
      jitter: false,
    });
  });

  describe("classifyError", () => {
    it("should classify network errors correctly", () => {
      const networkError = new Error("ENOTFOUND example.com");
      networkError.name = "NetworkError";
      (networkError as any).code = "ENOTFOUND";

      const classified = errorHandler.classifyError(networkError, "test");
      expect(classified).toBeInstanceOf(NetworkError);
      expect(classified.retryable).toBe(true);
    });

    it("should classify authentication errors correctly", () => {
      const authError = new Error("Unauthorized");
      (authError as any).status = 401;

      const classified = errorHandler.classifyError(authError, "test");
      expect(classified).toBeInstanceOf(AuthenticationError);
      expect(classified.retryable).toBe(false);
      expect(classified.statusCode).toBe(401);
    });

    it("should classify rate limit errors correctly", () => {
      const rateLimitError = new Error("Too many requests");
      (rateLimitError as any).status = 429;
      (rateLimitError as any).headers = { "retry-after": "60" };

      const classified = errorHandler.classifyError(rateLimitError, "test");
      expect(classified).toBeInstanceOf(RateLimitError);
      expect(classified.retryable).toBe(true);
      expect((classified as RateLimitError).retryAfter).toBe(60000);
    });

    it("should classify timeout errors correctly", () => {
      const timeoutError = new Error("Request timed out");
      (timeoutError as any).code = "ETIMEDOUT";

      const classified = errorHandler.classifyError(timeoutError, "test");
      expect(classified).toBeInstanceOf(TimeoutError);
      expect(classified.retryable).toBe(true);
    });

    it("should classify validation errors correctly", () => {
      const validationError = new Error("Invalid input");
      (validationError as any).status = 400;

      const classified = errorHandler.classifyError(validationError, "test");
      expect(classified).toBeInstanceOf(ValidationError);
      expect(classified.retryable).toBe(false);
    });
  });

  describe("executeWithRetry", () => {
    it("should succeed on first attempt", async () => {
      const operation = jest.fn().mockResolvedValue("success");

      const result = await errorHandler.executeWithRetry(operation, "test");

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry retryable errors", async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new NetworkError("Network error"))
        .mockResolvedValue("success");

      const result = await errorHandler.executeWithRetry(operation, "test");

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("should not retry non-retryable errors", async () => {
      const operation = jest.fn().mockRejectedValue(new AuthenticationError("Unauthorized"));

      await expect(errorHandler.executeWithRetry(operation, "test")).rejects.toThrow(
        "Unauthorized",
      );

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should respect max retries", async () => {
      const operation = jest.fn().mockRejectedValue(new NetworkError("Network error"));

      await expect(errorHandler.executeWithRetry(operation, "test")).rejects.toThrow(
        "Network error",
      );

      expect(operation).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it("should track error metrics", async () => {
      const operation = jest.fn().mockRejectedValue(new NetworkError("Network error"));

      try {
        await errorHandler.executeWithRetry(operation, "test");
      } catch (error) {
        // Expected to fail
      }

      const metrics = errorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(3); // 1 initial + 2 retries
      expect(metrics.errorsByType["NETWORK_ERROR"]).toBe(3);
      expect(metrics.retryAttempts).toBe(2);
    });
  });
});
