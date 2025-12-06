/**
 * Usage Tracker
 * Tracks API usage for billing and analytics
 */

import { TenantContext } from "@lighthouse-tooling/types";
import { TenantStore } from "../storage/TenantStore.js";
import { Logger } from "@lighthouse-tooling/shared";

/**
 * Usage event types
 */
export enum UsageEventType {
  FILE_UPLOAD = "file_upload",
  FILE_DOWNLOAD = "file_download",
  FILE_DELETE = "file_delete",
  DATASET_CREATE = "dataset_create",
  DATASET_READ = "dataset_read",
  DATASET_DELETE = "dataset_delete",
  API_CALL = "api_call",
}

/**
 * Usage event data
 */
export interface UsageEvent {
  eventType: UsageEventType;
  timestamp: string;
  organizationId: string;
  teamId?: string;
  userId: string;
  apiKeyId: string;
  toolName: string;
  resourceId?: string;
  bytesTransferred?: number;
  durationMs?: number;
  success: boolean;
  metadata?: Record<string, any>;
}

/**
 * Usage summary
 */
export interface UsageSummary {
  organizationId: string;
  teamId?: string;
  period: { start: string; end: string };
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalBytesUploaded: number;
  totalBytesDownloaded: number;
  totalStorageUsed: number;
  topUsers: Array<{ userId: string; requestCount: number }>;
  topTools: Array<{ toolName: string; requestCount: number }>;
  eventsByType: Record<UsageEventType, number>;
}

/**
 * Usage Tracker Options
 */
export interface UsageTrackerOptions {
  store: TenantStore;
  logger: Logger;
  enableTracking?: boolean;
  batchSize?: number;
  flushInterval?: number; // milliseconds
}

/**
 * Usage Tracker - Tracks detailed usage for analytics
 */
export class UsageTracker {
  private store: TenantStore;
  private logger: Logger;
  private enableTracking: boolean;
  private batchSize: number;
  private flushInterval: number;
  private eventQueue: UsageEvent[];
  private flushTimer?: NodeJS.Timeout;

  constructor(options: UsageTrackerOptions) {
    this.store = options.store;
    this.logger = options.logger;
    this.enableTracking = options.enableTracking ?? true;
    this.batchSize = options.batchSize || 100;
    this.flushInterval = options.flushInterval || 30000; // 30 seconds
    this.eventQueue = [];

    if (this.enableTracking) {
      this.startFlushTimer();
    }
  }

  /**
   * Track a usage event
   */
  public async trackEvent(
    context: TenantContext,
    eventType: UsageEventType,
    details: {
      toolName: string;
      resourceId?: string;
      bytesTransferred?: number;
      durationMs?: number;
      success: boolean;
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    if (!this.enableTracking) {
      return;
    }

    const event: UsageEvent = {
      eventType,
      timestamp: new Date().toISOString(),
      organizationId: context.organization.id,
      teamId: context.team?.id,
      userId: context.user.userId,
      apiKeyId: context.apiKey.id,
      toolName: details.toolName,
      resourceId: details.resourceId,
      bytesTransferred: details.bytesTransferred,
      durationMs: details.durationMs,
      success: details.success,
      metadata: details.metadata,
    };

    this.eventQueue.push(event);

    // Flush if batch size reached
    if (this.eventQueue.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * Track file upload
   */
  public async trackFileUpload(
    context: TenantContext,
    fileSize: number,
    fileId: string,
    durationMs: number,
    success: boolean,
  ): Promise<void> {
    await this.trackEvent(context, UsageEventType.FILE_UPLOAD, {
      toolName: "lighthouse-upload",
      resourceId: fileId,
      bytesTransferred: fileSize,
      durationMs,
      success,
    });
  }

  /**
   * Track file download
   */
  public async trackFileDownload(
    context: TenantContext,
    fileSize: number,
    fileId: string,
    durationMs: number,
    success: boolean,
  ): Promise<void> {
    await this.trackEvent(context, UsageEventType.FILE_DOWNLOAD, {
      toolName: "lighthouse-download",
      resourceId: fileId,
      bytesTransferred: fileSize,
      durationMs,
      success,
    });
  }

  /**
   * Track dataset creation
   */
  public async trackDatasetCreate(
    context: TenantContext,
    datasetId: string,
    durationMs: number,
    success: boolean,
  ): Promise<void> {
    await this.trackEvent(context, UsageEventType.DATASET_CREATE, {
      toolName: "lighthouse-create-dataset",
      resourceId: datasetId,
      durationMs,
      success,
    });
  }

  /**
   * Track API call
   */
  public async trackApiCall(
    context: TenantContext,
    toolName: string,
    durationMs: number,
    success: boolean,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.trackEvent(context, UsageEventType.API_CALL, {
      toolName,
      durationMs,
      success,
      metadata,
    });
  }

  /**
   * Flush events to storage
   */
  public async flush(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Group events by organization
      const eventsByOrg = new Map<string, UsageEvent[]>();

      for (const event of events) {
        const orgEvents = eventsByOrg.get(event.organizationId) || [];
        orgEvents.push(event);
        eventsByOrg.set(event.organizationId, orgEvents);
      }

      // Write to audit log for each organization
      for (const [orgId, orgEvents] of eventsByOrg.entries()) {
        for (const event of orgEvents) {
          await this.store.appendAuditLog(orgId, {
            id: this.generateEventId(),
            organizationId: event.organizationId,
            teamId: event.teamId,
            userId: event.userId,
            action: event.eventType,
            resource: event.toolName,
            resourceId: event.resourceId || "",
            timestamp: event.timestamp,
            result: event.success ? "success" : "failure",
            metadata: {
              ...event.metadata,
              bytesTransferred: event.bytesTransferred,
              durationMs: event.durationMs,
            },
          });
        }
      }

      this.logger.debug("Usage events flushed", { count: events.length });
    } catch (error) {
      this.logger.error("Failed to flush usage events", error as Error);
      // Re-queue events on failure
      this.eventQueue.unshift(...events);
    }
  }

  /**
   * Get usage summary for a period
   */
  public async getUsageSummary(
    organizationId: string,
    teamId: string | undefined,
    startDate: Date,
    endDate: Date,
  ): Promise<UsageSummary> {
    const auditLogs = await this.store.getAuditLogs(organizationId, 10000);

    // Filter by date and team
    const filteredLogs = auditLogs.filter((log) => {
      const logDate = new Date(log.timestamp);
      const matchesDate = logDate >= startDate && logDate <= endDate;
      const matchesTeam = teamId ? log.teamId === teamId : true;
      return matchesDate && matchesTeam;
    });

    // Aggregate statistics
    const summary: UsageSummary = {
      organizationId,
      teamId,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      totalRequests: filteredLogs.length,
      successfulRequests: filteredLogs.filter((log) => log.result === "success").length,
      failedRequests: filteredLogs.filter((log) => log.result === "failure").length,
      totalBytesUploaded: 0,
      totalBytesDownloaded: 0,
      totalStorageUsed: 0,
      topUsers: [],
      topTools: [],
      eventsByType: {} as Record<UsageEventType, number>,
    };

    // Count by user
    const userCounts = new Map<string, number>();
    const toolCounts = new Map<string, number>();

    for (const log of filteredLogs) {
      // User counts
      const userCount = userCounts.get(log.userId) || 0;
      userCounts.set(log.userId, userCount + 1);

      // Tool counts
      const toolCount = toolCounts.get(log.resource) || 0;
      toolCounts.set(log.resource, toolCount + 1);

      // Bytes transferred
      if (log.metadata?.bytesTransferred) {
        if (
          log.action === UsageEventType.FILE_UPLOAD ||
          log.action === UsageEventType.DATASET_CREATE
        ) {
          summary.totalBytesUploaded += log.metadata.bytesTransferred;
        } else if (log.action === UsageEventType.FILE_DOWNLOAD) {
          summary.totalBytesDownloaded += log.metadata.bytesTransferred;
        }
      }

      // Event types
      const eventType = log.action as UsageEventType;
      summary.eventsByType[eventType] = (summary.eventsByType[eventType] || 0) + 1;
    }

    // Top users
    summary.topUsers = Array.from(userCounts.entries())
      .map(([userId, count]) => ({ userId, requestCount: count }))
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 10);

    // Top tools
    summary.topTools = Array.from(toolCounts.entries())
      .map(([toolName, count]) => ({ toolName, requestCount: count }))
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 10);

    return summary;
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      try {
        await this.flush();
      } catch (error) {
        this.logger.error("Failed to flush usage events", error as Error);
      }
    }, this.flushInterval);
  }

  /**
   * Stop usage tracker
   */
  public async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Flush remaining events
    await this.flush();
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}
