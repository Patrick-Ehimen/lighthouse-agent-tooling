import { ConnectionPool, ConnectionPoolConfig } from "../pool";

// Mock axios
jest.mock("axios", () => {
  const mockInstance = {
    request: jest.fn().mockResolvedValue({ data: { success: true }, status: 200 }),
  };
  return {
    create: jest.fn(() => mockInstance),
    __mockInstance: mockInstance,
  };
});

// Mock http and https agents
jest.mock("http", () => ({
  Agent: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("https", () => ({
  Agent: jest.fn().mockImplementation(() => ({})),
}));

describe("ConnectionPool", () => {
  let pool: ConnectionPool;

  afterEach(() => {
    if (pool) {
      pool.destroy();
    }
  });

  describe("constructor", () => {
    it("should create pool with default config", () => {
      pool = new ConnectionPool();

      const stats = pool.getStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.activeConnections).toBe(0);
      expect(stats.idleConnections).toBe(0);
      expect(stats.queuedRequests).toBe(0);
      expect(stats.totalRequests).toBe(0);
      expect(stats.averageWaitTime).toBe(0);
    });

    it("should create pool with custom config", () => {
      const config: ConnectionPoolConfig = {
        maxConnections: 5,
        acquireTimeout: 3000,
        idleTimeout: 30000,
        requestTimeout: 10000,
        keepAlive: false,
        maxSockets: 20,
      };

      pool = new ConnectionPool(config);
      expect(pool.size).toBe(0);
    });
  });

  describe("acquire and release", () => {
    it("should acquire a connection and increment stats", async () => {
      pool = new ConnectionPool({ maxConnections: 5 });

      const instance = await pool.acquire();
      expect(instance).toBeDefined();
      expect(instance.request).toBeDefined();
      expect(pool.size).toBe(1);
      expect(pool.activeCount).toBe(1);

      pool.release(instance);
      expect(pool.activeCount).toBe(0);
    });

    it("should reuse released connections", async () => {
      pool = new ConnectionPool({ maxConnections: 5 });

      const instance1 = await pool.acquire();
      pool.release(instance1);

      const instance2 = await pool.acquire();
      expect(instance2).toBe(instance1);
      expect(pool.size).toBe(1);

      pool.release(instance2);
    });

    it("should create new connections when none are idle", async () => {
      pool = new ConnectionPool({ maxConnections: 5 });

      const instance1 = await pool.acquire();
      const instance2 = await pool.acquire();

      expect(pool.size).toBe(2);
      expect(pool.activeCount).toBe(2);

      pool.release(instance1);
      pool.release(instance2);
    });

    it("should track total requests", async () => {
      pool = new ConnectionPool({ maxConnections: 5 });

      const instance1 = await pool.acquire();
      pool.release(instance1);

      const instance2 = await pool.acquire();
      pool.release(instance2);

      const stats = pool.getStats();
      expect(stats.totalRequests).toBe(2);
    });
  });

  describe("max connections and queuing", () => {
    it("should queue requests when max connections reached", async () => {
      pool = new ConnectionPool({ maxConnections: 2, acquireTimeout: 2000 });

      const conn1 = await pool.acquire();
      const conn2 = await pool.acquire();

      expect(pool.size).toBe(2);
      expect(pool.activeCount).toBe(2);

      // This should queue since max is 2
      let resolved = false;
      const queuedPromise = pool.acquire().then((conn) => {
        resolved = true;
        return conn;
      });

      expect(pool.queueSize).toBe(1);

      // Release one to unblock the queue
      pool.release(conn1);

      const conn3 = await queuedPromise;
      expect(resolved).toBe(true);
      expect(conn3).toBe(conn1);

      pool.release(conn2);
      pool.release(conn3);
    });

    it("should reject with timeout when pool is exhausted", async () => {
      pool = new ConnectionPool({ maxConnections: 1, acquireTimeout: 100 });

      const conn1 = await pool.acquire();

      await expect(pool.acquire()).rejects.toThrow("Connection acquire timeout");

      pool.release(conn1);
    });
  });

  describe("execute", () => {
    it("should execute a request and return data", async () => {
      pool = new ConnectionPool({ maxConnections: 5 });

      const result = await pool.execute({ method: "GET", url: "https://example.com" });
      expect(result).toEqual({ success: true });

      expect(pool.activeCount).toBe(0);
      expect(pool.getStats().totalRequests).toBe(1);
    });

    it("should release connection even if request fails", async () => {
      pool = new ConnectionPool({ maxConnections: 5 });

      const axios = require("axios");
      const mockInstance = axios.__mockInstance;
      mockInstance.request.mockRejectedValueOnce(new Error("Network error"));

      await expect(pool.execute({ method: "GET", url: "https://example.com" })).rejects.toThrow(
        "Network error",
      );

      expect(pool.activeCount).toBe(0);
    });
  });

  describe("getStats", () => {
    it("should return accurate statistics", async () => {
      pool = new ConnectionPool({ maxConnections: 5 });

      const conn1 = await pool.acquire();
      const conn2 = await pool.acquire();
      pool.release(conn1);

      const stats = pool.getStats();
      expect(stats.totalConnections).toBe(2);
      expect(stats.activeConnections).toBe(1);
      expect(stats.idleConnections).toBe(1);
      expect(stats.queuedRequests).toBe(0);
      expect(stats.totalRequests).toBe(2);
      expect(stats.averageWaitTime).toBeGreaterThanOrEqual(0);

      pool.release(conn2);
    });
  });

  describe("events", () => {
    it("should emit create event on first acquire", async () => {
      pool = new ConnectionPool({ maxConnections: 5 });

      const events: string[] = [];
      pool.on("create", () => events.push("create"));
      pool.on("acquire", () => events.push("acquire"));

      const conn = await pool.acquire();
      expect(events).toContain("create");

      pool.release(conn);
    });

    it("should emit acquire event when reusing connection", async () => {
      pool = new ConnectionPool({ maxConnections: 5 });

      const events: string[] = [];

      const conn = await pool.acquire();
      pool.release(conn);

      pool.on("acquire", () => events.push("acquire"));
      const conn2 = await pool.acquire();
      expect(events).toContain("acquire");

      pool.release(conn2);
    });

    it("should emit release event", async () => {
      pool = new ConnectionPool({ maxConnections: 5 });

      const events: string[] = [];
      pool.on("release", () => events.push("release"));

      const conn = await pool.acquire();
      pool.release(conn);

      expect(events).toContain("release");
    });

    it("should emit queue event when pool is exhausted", async () => {
      pool = new ConnectionPool({ maxConnections: 1, acquireTimeout: 500 });

      const events: string[] = [];
      pool.on("queue", () => events.push("queue"));

      const conn = await pool.acquire();

      // This will queue and eventually timeout
      pool.acquire().catch(() => {});

      expect(events).toContain("queue");

      pool.release(conn);
    });
  });

  describe("destroy", () => {
    it("should clear all connections", () => {
      pool = new ConnectionPool({ maxConnections: 5 });

      pool.destroy();

      expect(pool.size).toBe(0);
      expect(pool.queueSize).toBe(0);
    });

    it("should reject queued requests on destroy", async () => {
      pool = new ConnectionPool({ maxConnections: 1, acquireTimeout: 5000 });

      const conn = await pool.acquire();

      const queuedPromise = pool.acquire();

      pool.destroy();

      await expect(queuedPromise).rejects.toThrow("Connection pool destroyed");
    });
  });

  describe("size properties", () => {
    it("should report correct size", async () => {
      pool = new ConnectionPool({ maxConnections: 5 });

      expect(pool.size).toBe(0);

      const conn = await pool.acquire();
      expect(pool.size).toBe(1);

      pool.release(conn);
      expect(pool.size).toBe(1); // Still in pool, just idle
    });

    it("should report correct activeCount", async () => {
      pool = new ConnectionPool({ maxConnections: 5 });

      expect(pool.activeCount).toBe(0);

      const conn = await pool.acquire();
      expect(pool.activeCount).toBe(1);

      pool.release(conn);
      expect(pool.activeCount).toBe(0);
    });

    it("should report correct queueSize", async () => {
      pool = new ConnectionPool({ maxConnections: 1, acquireTimeout: 500 });

      const conn = await pool.acquire();
      expect(pool.queueSize).toBe(0);

      pool.acquire().catch(() => {});
      expect(pool.queueSize).toBe(1);

      pool.release(conn);
    });
  });

  describe("release unknown connection", () => {
    it("should warn when releasing an unknown connection", () => {
      pool = new ConnectionPool({ maxConnections: 5 });

      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      const fakeInstance = { request: jest.fn() } as any;
      pool.release(fakeInstance);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("unknown connection"));

      warnSpy.mockRestore();
    });
  });
});
