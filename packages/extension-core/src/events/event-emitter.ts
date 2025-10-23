/**
 * Extension event emitter implementation
 * @fileoverview Event system for the extension core
 */

import type { ExtensionEvent } from "../types/index.js";
import { EventEmitter } from "events";
import { Logger } from "@lighthouse-tooling/shared";

/**
 * Extension event emitter
 */
export class ExtensionEventEmitter extends EventEmitter {
  private _logger: Logger;

  constructor() {
    super();
    this._logger = new Logger({ level: "info", component: "ExtensionEventEmitter" });

    // Set max listeners to avoid warnings
    this.setMaxListeners(100);
  }

  /**
   * Emit an extension event
   */
  emit(eventType: string, event: ExtensionEvent | any): boolean {
    this._logger.debug(`Emitting event: ${eventType}`, event);
    return super.emit(eventType, event);
  }

  /**
   * Add event listener with error handling
   */
  on(eventType: string, listener: (...args: any[]) => void): this {
    const wrappedListener = (...args: any[]) => {
      try {
        listener(...args);
      } catch (error) {
        this._logger.error(`Error in event listener for ${eventType}:`, error as Error);
      }
    };

    return super.on(eventType, wrappedListener);
  }

  /**
   * Add one-time event listener with error handling
   */
  once(eventType: string, listener: (...args: any[]) => void): this {
    const wrappedListener = (...args: any[]) => {
      try {
        listener(...args);
      } catch (error) {
        this._logger.error(`Error in one-time event listener for ${eventType}:`, error as Error);
      }
    };

    return super.once(eventType, wrappedListener);
  }

  /**
   * Get event listener count
   */
  getListenerCount(eventType: string): number {
    return this.listenerCount(eventType);
  }

  /**
   * Get all event names
   */
  getEventNames(): (string | symbol)[] {
    return this.eventNames();
  }
}
