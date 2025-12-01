/**
 * Tests for Operation Queue
 */

import {
  OperationQueue,
  OperationType,
  OperationStatus,
  OperationExecutor,
  QueuedOperation,
} from "../OperationQueue";

class MockExecutor implements OperationExecutor {
  private shouldSucceed = true;
  private canExecuteValue = true;

  async execute(operation: QueuedOperation): Promise<unknown> {
    if (!this.shouldSucceed) {
      throw new Error("Mock execution failed");
    }
    return { success: true, operationId: operation.id };
  }

  async canExecute(): Promise<boolean> {
    return this.canExecuteValue;
  }

  setCanExecute(value: boolean): void {
    this.canExecuteValue = value;
  }

  setShouldSucceed(value: boolean): void {
    this.shouldSucceed = value;
  }
}

describe("OperationQueue", () => {
  let queue: OperationQueue;
  let executor: MockExecutor;

  beforeEach(() => {
    queue = new OperationQueue({
      maxQueueSize: 10,
      maxRetries: 3,
      retryDelay: 100,
      persistenceEnabled: false,
    });
    executor = new MockExecutor();
    queue.setExecutor(executor);
  });

  afterEach(async () => {
    await queue.dispose();
  });

  describe("enqueue", () => {
    it("should enqueue an operation", async () => {
      const id = await queue.enqueue(OperationType.UPLOAD_FILE, {
        filePath: "/test/file.txt",
      });

      expect(id).toBeDefined();
      expect(id).toMatch(/^op_/);

      const operation = queue.getOperation(id);
      expect(operation).toBeDefined();
      expect(operation?.type).toBe(OperationType.UPLOAD_FILE);
      expect(operation?.status).toBe(OperationStatus.PENDING);
    });

    it("should enforce max queue size", async () => {
      const smallQueue = new OperationQueue({ maxQueueSize: 2 });

      await smallQueue.enqueue(OperationType.UPLOAD_FILE, {});
      await smallQueue.enqueue(OperationType.UPLOAD_FILE, {});

      await expect(smallQueue.enqueue(OperationType.UPLOAD_FILE, {})).rejects.toThrow(
        "Queue size limit reached",
      );

      await smallQueue.dispose();
    });

    it("should emit enqueued event", async () => {
      const listener = jest.fn();
      queue.on("enqueued", listener);

      await queue.enqueue(OperationType.UPLOAD_FILE, {});

      expect(listener).toHaveBeenCalled();
    });
  });

  describe("processQueue", () => {
    it("should process pending operations", async () => {
      executor.setCanExecute(true);
      const id = await queue.enqueue(OperationType.UPLOAD_FILE, {});

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      const operation = queue.getOperation(id);
      expect(operation?.status).toBe(OperationStatus.COMPLETED);
    });

    it("should retry failed operations", async () => {
      executor.setShouldSucceed(false);
      const id = await queue.enqueue(OperationType.UPLOAD_FILE, {});

      // Wait for initial failure and retry
      await new Promise((resolve) => setTimeout(resolve, 500));

      const operation = queue.getOperation(id);
      expect(operation?.retryCount).toBeGreaterThan(0);
    });

    it("should mark operation as failed after max retries", async () => {
      executor.setShouldSucceed(false);
      const id = await queue.enqueue(OperationType.UPLOAD_FILE, {}, { maxRetries: 2 });

      // Wait for all retries to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const operation = queue.getOperation(id);
      expect(operation?.status).toBe(OperationStatus.FAILED);
      expect(operation?.retryCount).toBe(2);
    });

    it("should not process when executor cannot execute", async () => {
      executor.setCanExecute(false);
      const id = await queue.enqueue(OperationType.UPLOAD_FILE, {});

      await new Promise((resolve) => setTimeout(resolve, 200));

      const operation = queue.getOperation(id);
      expect(operation?.status).toBe(OperationStatus.PENDING);
    });
  });

  describe("cancelOperation", () => {
    it("should cancel pending operation", async () => {
      executor.setCanExecute(false); // Prevent processing
      const id = await queue.enqueue(OperationType.UPLOAD_FILE, {});

      const cancelled = await queue.cancelOperation(id);
      expect(cancelled).toBe(true);

      const operation = queue.getOperation(id);
      expect(operation?.status).toBe(OperationStatus.CANCELLED);
    });

    it("should not cancel processing operation", async () => {
      const id = await queue.enqueue(OperationType.UPLOAD_FILE, {});

      // Manually set to processing
      const operation = queue.getOperation(id)!;
      operation.status = OperationStatus.PROCESSING;

      const cancelled = await queue.cancelOperation(id);
      expect(cancelled).toBe(false);
    });
  });

  describe("retryOperation", () => {
    it("should retry failed operation", async () => {
      executor.setShouldSucceed(false);
      const id = await queue.enqueue(OperationType.UPLOAD_FILE, {}, { maxRetries: 1 });

      // Wait for failure
      await new Promise((resolve) => setTimeout(resolve, 500));

      executor.setShouldSucceed(true);
      const retried = await queue.retryOperation(id);
      expect(retried).toBe(true);

      const operation = queue.getOperation(id);
      expect(operation?.status).toBe(OperationStatus.PENDING);
      expect(operation?.retryCount).toBe(0);
    });

    it("should not retry non-failed operation", async () => {
      const id = await queue.enqueue(OperationType.UPLOAD_FILE, {});

      const retried = await queue.retryOperation(id);
      expect(retried).toBe(false);
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", async () => {
      executor.setCanExecute(false);

      await queue.enqueue(OperationType.UPLOAD_FILE, {});
      await queue.enqueue(OperationType.FETCH_FILE, {});

      const stats = queue.getStats();
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2);
      expect(stats.processing).toBe(0);
      expect(stats.completed).toBe(0);
    });
  });

  describe("clearCompleted", () => {
    it("should clear completed operations", async () => {
      executor.setCanExecute(true);
      await queue.enqueue(OperationType.UPLOAD_FILE, {});

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 200));

      const cleared = await queue.clearCompleted();
      expect(cleared).toBe(1);
      expect(queue.getStats().total).toBe(0);
    });
  });

  describe("events", () => {
    it("should emit completed event", async () => {
      const listener = jest.fn();
      queue.on("completed", listener);

      executor.setCanExecute(true);
      await queue.enqueue(OperationType.UPLOAD_FILE, {});

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(listener).toHaveBeenCalled();
    });

    it("should emit failed event", async () => {
      const listener = jest.fn();
      queue.on("failed", listener);

      executor.setShouldSucceed(false);
      await queue.enqueue(OperationType.UPLOAD_FILE, {}, { maxRetries: 1 });

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(listener).toHaveBeenCalled();
    });
  });
});
