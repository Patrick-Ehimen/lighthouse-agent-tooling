import { RateLimiter } from "../utils/RateLimiter";

describe("RateLimiter", () => {
  it("should allow requests within rate limit", async () => {
    const limiter = new RateLimiter(5, 1, 1000);

    const start = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it("should queue requests when limit exceeded", async () => {
    const limiter = new RateLimiter(2, 2, 100);

    const results: number[] = [];
    const promises = [
      limiter.acquire().then(() => results.push(1)),
      limiter.acquire().then(() => results.push(2)),
      limiter.acquire().then(() => results.push(3)),
    ];

    await Promise.all(promises);
    expect(results).toHaveLength(3);
  }, 5000);

  it("should track available tokens", () => {
    const limiter = new RateLimiter(10, 1, 1000);
    expect(limiter.getAvailableTokens()).toBe(10);
  });

  it("should track queue length", async () => {
    const limiter = new RateLimiter(1, 1, 1000);

    limiter.acquire();
    limiter.acquire();

    expect(limiter.getQueueLength()).toBeGreaterThan(0);
  });

  it("should refill tokens over time", async () => {
    const limiter = new RateLimiter(5, 5, 100);

    await limiter.acquire();
    await limiter.acquire();

    const tokensBefore = limiter.getAvailableTokens();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const tokensAfter = limiter.getAvailableTokens();

    expect(tokensAfter).toBeGreaterThan(tokensBefore);
  });
});
