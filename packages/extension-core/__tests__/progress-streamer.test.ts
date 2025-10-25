/**
 * Progress streamer tests
 * @fileoverview Tests for the progress streaming functionality
 */

import { ProgressStreamerImpl } from "../src/core/progress-streamer";
import { ExtensionEventEmitter } from "../src/events/event-emitter";

describe("ProgressStreamer", () => {
  let progressStreamer: ProgressStreamerImpl;
  let eventEmitter: ExtensionEventEmitter;

  beforeEach(() => {
    eventEmitter = new ExtensionEventEmitter();
    progressStreamer = new ProgressStreamerImpl(eventEmitter);
  });

  describe("progress stream management", () => {
    it("should start a progress stream", () => {
      const stream = progressStreamer.startProgress("test-op", "Test Operation");

      expect(stream.operationId).toBe("test-op");
      expect(stream.title).toBe("Test Operation");
      expect(stream.isActive()).toBe(true);
      expect(progressStreamer.getProgress("test-op")).toBe(stream);
    });

    it("should update progress", () => {
      const stream = progressStreamer.startProgress("test-op", "Test Operation");

      stream.update({
        progress: 50,
        message: "Half way done",
      });

      const currentProgress = stream.getCurrentProgress();
      expect(currentProgress.progress).toBe(50);
      expect(currentProgress.message).toBe("Half way done");
    });

    it("should complete progress", () => {
      const stream = progressStreamer.startProgress("test-op", "Test Operation");

      stream.complete({ result: "success" });

      expect(stream.isActive()).toBe(false);
      const currentProgress = stream.getCurrentProgress();
      expect(currentProgress.completed).toBe(true);
      expect(currentProgress.result).toEqual({ result: "success" });
    });

    it("should fail progress", () => {
      const stream = progressStreamer.startProgress("test-op", "Test Operation");
      const error = new Error("Test error");

      stream.fail(error);

      expect(stream.isActive()).toBe(false);
      const currentProgress = stream.getCurrentProgress();
      expect(currentProgress.completed).toBe(true);
      expect(currentProgress.error).toBe("Test error");
    });

    it("should cancel progress", () => {
      const stream = progressStreamer.startProgress("test-op", "Test Operation");

      stream.cancel();

      expect(stream.isActive()).toBe(false);
      const currentProgress = stream.getCurrentProgress();
      expect(currentProgress.cancelled).toBe(true);
    });
  });

  describe("stream collection management", () => {
    it("should get active streams", () => {
      const stream1 = progressStreamer.startProgress("op1", "Operation 1");
      const stream2 = progressStreamer.startProgress("op2", "Operation 2");

      expect(progressStreamer.getActiveStreams()).toHaveLength(2);

      stream1.complete();
      expect(progressStreamer.getActiveStreams()).toHaveLength(1);
    });

    it("should stop progress stream", () => {
      const stream = progressStreamer.startProgress("test-op", "Test Operation");
      expect(stream.isActive()).toBe(true);

      progressStreamer.stopProgress("test-op");
      expect(stream.isActive()).toBe(false);
      expect(progressStreamer.getProgress("test-op")).toBeUndefined();
    });

    it("should clear all streams", () => {
      progressStreamer.startProgress("op1", "Operation 1");
      progressStreamer.startProgress("op2", "Operation 2");

      expect(progressStreamer.getActiveStreams()).toHaveLength(2);

      progressStreamer.clearAllStreams();
      expect(progressStreamer.getActiveStreams()).toHaveLength(0);
    });
  });
});
