/**
 * Simple token bucket rate limiter for API requests
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private queue: Array<() => void> = [];

  constructor(
    private maxTokens: number = 10,
    private refillRate: number = 1,
    private refillInterval: number = 1000,
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = (timePassed / this.refillInterval) * this.refillRate;

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  private processQueue(): void {
    this.refillTokens();
    while (this.queue.length > 0 && this.tokens >= 1) {
      this.tokens--;
      const resolve = this.queue.shift();
      resolve?.();
    }

    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), this.refillInterval / 2);
    }
  }

  async acquire(): Promise<void> {
    this.refillTokens();

    if (this.tokens >= 1) {
      this.tokens--;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      if (this.queue.length === 1) {
        setTimeout(() => this.processQueue(), this.refillInterval / 2);
      }
    });
  }

  getAvailableTokens(): number {
    this.refillTokens();
    return Math.floor(this.tokens);
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}
