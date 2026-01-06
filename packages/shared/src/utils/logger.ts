/**
 * Structured logging utilities for consistent logging across the system
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  component?: string;
  operation?: string;
  duration?: number;
}

export interface LoggerConfig {
  level: LogLevel;
  component?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
}

export class Logger {
  private config: LoggerConfig;
  private static instance: Logger;
  private logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  };

  constructor(config: LoggerConfig) {
    this.config = {
      enableConsole: true,
      enableFile: false,
      ...config,
    };
  }

  /**
   * Get singleton logger instance
   */
  static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config || { level: "info" });
    }
    return Logger.instance;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, any>): Logger {
    const childConfig = {
      ...this.config,
      component: context.component || this.config.component,
    };

    const childLogger = new Logger(childConfig);
    // Store additional context for all logs from this child
    (childLogger as any).childContext = context;
    return childLogger;
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log("debug", message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log("info", message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log("warn", message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log("error", message, context, error);
  }

  /**
   * Log fatal error message
   */
  fatal(message: string, error?: Error, context?: Record<string, any>): void {
    this.log("fatal", message, context, error);
  }

  /**
   * Log operation timing
   */
  time<T>(operation: string, fn: () => Promise<T>): Promise<T>;
  time<T>(operation: string, fn: () => T): T;
  time<T>(operation: string, fn: () => T | Promise<T>): T | Promise<T> {
    const startTime = Date.now();

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result
          .then((value) => {
            const duration = Date.now() - startTime;
            this.info(`Operation completed: ${operation}`, {
              operation,
              duration,
            });
            return value;
          })
          .catch((error) => {
            const duration = Date.now() - startTime;
            this.error(`Operation failed: ${operation}`, error, {
              operation,
              duration,
            });
            throw error;
          });
      } else {
        const duration = Date.now() - startTime;
        this.info(`Operation completed: ${operation}`, { operation, duration });
        return result;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(`Operation failed: ${operation}`, error as Error, {
        operation,
        duration,
      });
      throw error;
    }
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error,
  ): void {
    // Check if log level is enabled
    if (this.logLevels[level] < this.logLevels[this.config.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component: this.config.component,
      context: {
        ...(this as any).childContext,
        ...context,
      },
      error,
    };

    // Output to console if enabled
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // Output to file if enabled
    if (this.config.enableFile && this.config.filePath) {
      this.logToFile(entry);
    }
  }

  /**
   * Log to console with appropriate formatting
   */
  private logToConsole(entry: LogEntry): void {
    const { timestamp, level, message, component, context, error } = entry;

    const prefix = `[${timestamp}] ${level.toUpperCase()}${component ? ` [${component}]` : ""}:`;
    const contextStr =
      context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";

    const logMessage = `${prefix} ${message}${contextStr}`;

    // For MCP stdio transport, all logs should go to stderr to avoid interfering with JSON-RPC on stdout
    switch (level) {
      case "debug":
        console.error(logMessage); // Redirect to stderr
        break;
      case "info":
        console.error(logMessage); // Redirect to stderr
        break;
      case "warn":
        console.error(logMessage); // Already stderr, but be explicit
        break;
      case "error":
      case "fatal":
        console.error(logMessage);
        if (error) {
          console.error(error.stack || error.message);
        }
        break;
    }
  }

  /**
   * Log to file (simplified implementation)
   */
  private async logToFile(entry: LogEntry): Promise<void> {
    try {
      const fs = await import("fs/promises");
      const logLine = JSON.stringify(entry) + "\n";
      await fs.appendFile(this.config.filePath!, logLine);
    } catch (error) {
      // Fallback to console if file logging fails
      console.error("Failed to write to log file:", error);
      this.logToConsole(entry);
    }
  }

  /**
   * Update logger configuration
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

/**
 * Default logger instance
 */
export const logger = Logger.getInstance({
  level: "info",
  component: "lighthouse-tooling",
});

/**
 * Create performance timer utility
 */
export class PerformanceTimer {
  private startTime: number;
  private operation: string;
  private logger: Logger;

  constructor(operation: string, logger: Logger = Logger.getInstance()) {
    this.operation = operation;
    this.logger = logger;
    this.startTime = Date.now();
    this.logger.debug(`Starting operation: ${operation}`);
  }

  /**
   * End timing and log result
   */
  end(context?: Record<string, any>): number {
    const duration = Date.now() - this.startTime;
    this.logger.info(`Operation completed: ${this.operation}`, {
      operation: this.operation,
      duration,
      ...context,
    });
    return duration;
  }

  /**
   * End timing with error and log result
   */
  endWithError(error: Error, context?: Record<string, any>): number {
    const duration = Date.now() - this.startTime;
    this.logger.error(`Operation failed: ${this.operation}`, error, {
      operation: this.operation,
      duration,
      ...context,
    });
    return duration;
  }
}
