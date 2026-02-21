/**
 * Prometheus Metrics Exporter
 *
 * Exports internal metrics in Prometheus text format for scraping
 * by Prometheus, Grafana, Datadog, and other monitoring systems.
 */

import * as client from "prom-client";
import { MetricsCollector, SecurityEventType } from "../auth/MetricsCollector.js";
import { ToolRegistry } from "../registry/ToolRegistry.js";
import { LighthouseServiceFactory } from "../auth/LighthouseServiceFactory.js";
import { ILighthouseService } from "../services/ILighthouseService.js";

export interface PrometheusExporterDependencies {
  metricsCollector: MetricsCollector;
  registry: ToolRegistry;
  serviceFactory: LighthouseServiceFactory;
  lighthouseService: ILighthouseService;
}

export class PrometheusExporter {
  private deps: PrometheusExporterDependencies;
  private registry: client.Registry;

  // Counters (initialized in initializeMetrics called from constructor)
  private authTotal!: client.Counter<"status">;
  private cacheHitsTotal!: client.Counter<string>;
  private cacheMissesTotal!: client.Counter<string>;
  private securityEventsTotal!: client.Counter<"type">;
  private toolCallsTotal!: client.Counter<"tool">;

  // Gauges (initialized in initializeMetrics called from constructor)
  private cacheSize!: client.Gauge<string>;
  private cacheMaxSize!: client.Gauge<string>;
  private servicePoolSize!: client.Gauge<string>;
  private servicePoolMaxSize!: client.Gauge<string>;
  private storageFiles!: client.Gauge<string>;
  private storageBytes!: client.Gauge<string>;
  private storageMaxBytes!: client.Gauge<string>;
  private storageUtilization!: client.Gauge<string>;
  private uniqueApiKeys!: client.Gauge<string>;
  private toolsRegistered!: client.Gauge<string>;

  // Histograms (initialized in initializeMetrics called from constructor)
  private requestDuration!: client.Histogram<"operation">;
  private authDuration!: client.Histogram<string>;

  // Track last known values to compute deltas for counters
  private lastCacheCounters = { hits: 0, misses: 0 };
  private lastAuthMetrics = {
    authenticatedRequests: 0,
    failedAuthentications: 0,
    fallbackRequests: 0,
  };
  private lastSecurityEventCounts: Map<string, number> = new Map();
  private lastToolCallCounts: Map<string, number> = new Map();

  constructor(deps: PrometheusExporterDependencies) {
    this.deps = deps;

    // Create a custom registry to avoid conflicts with default registry
    this.registry = new client.Registry();

    // Set default labels
    this.registry.setDefaultLabels({
      app: "lighthouse-mcp-server",
    });

    // Collect default Node.js process metrics
    client.collectDefaultMetrics({
      register: this.registry,
      prefix: "lighthouse_",
    });

    // Initialize custom metrics
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Authentication counters
    this.authTotal = new client.Counter({
      name: "lighthouse_auth_total",
      help: "Total authentication attempts",
      labelNames: ["status"],
      registers: [this.registry],
    });

    // Cache counters
    this.cacheHitsTotal = new client.Counter({
      name: "lighthouse_cache_hits_total",
      help: "Total cache hits",
      registers: [this.registry],
    });

    this.cacheMissesTotal = new client.Counter({
      name: "lighthouse_cache_misses_total",
      help: "Total cache misses",
      registers: [this.registry],
    });

    // Security events counter
    this.securityEventsTotal = new client.Counter({
      name: "lighthouse_security_events_total",
      help: "Total security events by type",
      labelNames: ["type"],
      registers: [this.registry],
    });

    // Tool calls counter
    this.toolCallsTotal = new client.Counter({
      name: "lighthouse_tool_calls_total",
      help: "Total tool calls by tool name",
      labelNames: ["tool"],
      registers: [this.registry],
    });

    // Cache gauges
    this.cacheSize = new client.Gauge({
      name: "lighthouse_cache_size",
      help: "Current cache size (number of entries)",
      registers: [this.registry],
    });

    this.cacheMaxSize = new client.Gauge({
      name: "lighthouse_cache_max_size",
      help: "Maximum cache size",
      registers: [this.registry],
    });

    // Service pool gauges
    this.servicePoolSize = new client.Gauge({
      name: "lighthouse_service_pool_size",
      help: "Current service pool size",
      registers: [this.registry],
    });

    this.servicePoolMaxSize = new client.Gauge({
      name: "lighthouse_service_pool_max_size",
      help: "Maximum service pool size",
      registers: [this.registry],
    });

    // Storage gauges
    this.storageFiles = new client.Gauge({
      name: "lighthouse_storage_files",
      help: "Number of files in storage",
      registers: [this.registry],
    });

    this.storageBytes = new client.Gauge({
      name: "lighthouse_storage_bytes",
      help: "Total storage usage in bytes",
      registers: [this.registry],
    });

    this.storageMaxBytes = new client.Gauge({
      name: "lighthouse_storage_max_bytes",
      help: "Maximum storage capacity in bytes",
      registers: [this.registry],
    });

    this.storageUtilization = new client.Gauge({
      name: "lighthouse_storage_utilization",
      help: "Storage utilization ratio (0-1)",
      registers: [this.registry],
    });

    // Unique API keys gauge
    this.uniqueApiKeys = new client.Gauge({
      name: "lighthouse_unique_api_keys",
      help: "Number of unique API keys seen",
      registers: [this.registry],
    });

    // Tools registered gauge
    this.toolsRegistered = new client.Gauge({
      name: "lighthouse_tools_registered",
      help: "Number of tools registered",
      registers: [this.registry],
    });

    // Request duration histogram
    this.requestDuration = new client.Histogram({
      name: "lighthouse_request_duration_seconds",
      help: "Request duration in seconds",
      labelNames: ["operation"],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // Authentication duration histogram
    this.authDuration = new client.Histogram({
      name: "lighthouse_auth_duration_seconds",
      help: "Authentication duration in seconds",
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
      registers: [this.registry],
    });
  }

  /**
   * Update all metrics from current state
   */
  private updateMetrics(): void {
    this.updateAuthMetrics();
    this.updateCacheMetrics();
    this.updateSecurityMetrics();
    this.updateToolMetrics();
    this.updateServicePoolMetrics();
    this.updateStorageMetrics();
  }

  private updateAuthMetrics(): void {
    const metrics = this.deps.metricsCollector.getMetrics();

    // Calculate deltas for counters (Prometheus counters only increment)
    const successDelta = metrics.authenticatedRequests - this.lastAuthMetrics.authenticatedRequests;
    const failureDelta = metrics.failedAuthentications - this.lastAuthMetrics.failedAuthentications;
    const fallbackDelta = metrics.fallbackRequests - this.lastAuthMetrics.fallbackRequests;

    if (successDelta > 0) {
      this.authTotal.labels("success").inc(successDelta);
    }
    if (failureDelta > 0) {
      this.authTotal.labels("failure").inc(failureDelta);
    }
    if (fallbackDelta > 0) {
      this.authTotal.labels("fallback").inc(fallbackDelta);
    }

    // Update last known values
    this.lastAuthMetrics = {
      authenticatedRequests: metrics.authenticatedRequests,
      failedAuthentications: metrics.failedAuthentications,
      fallbackRequests: metrics.fallbackRequests,
    };

    // Update gauge for unique API keys
    this.uniqueApiKeys.set(metrics.uniqueApiKeys);

    // Record average auth time in histogram (approximation)
    if (metrics.averageAuthTime > 0) {
      this.authDuration.observe(metrics.averageAuthTime / 1000);
    }
  }

  private updateCacheMetrics(): void {
    const cacheCounters = this.deps.metricsCollector.getCacheCounters();

    // Calculate deltas
    const hitsDelta = cacheCounters.hits - this.lastCacheCounters.hits;
    const missesDelta = cacheCounters.misses - this.lastCacheCounters.misses;

    if (hitsDelta > 0) {
      this.cacheHitsTotal.inc(hitsDelta);
    }
    if (missesDelta > 0) {
      this.cacheMissesTotal.inc(missesDelta);
    }

    // Update last known values
    this.lastCacheCounters = { ...cacheCounters };

    // Note: Cache size/maxSize would need to come from AuthManager.getCacheStats()
    // For now, we derive from the metrics collector's data
  }

  private updateSecurityMetrics(): void {
    const events = this.deps.metricsCollector.getSecurityEvents();

    // Count events by type
    const eventCounts: Map<string, number> = new Map();
    for (const eventType of Object.values(SecurityEventType)) {
      eventCounts.set(eventType, 0);
    }

    for (const event of events) {
      const current = eventCounts.get(event.type) || 0;
      eventCounts.set(event.type, current + 1);
    }

    // Calculate deltas and increment counters
    for (const [type, count] of eventCounts.entries()) {
      const lastCount = this.lastSecurityEventCounts.get(type) || 0;
      const delta = count - lastCount;
      if (delta > 0) {
        this.securityEventsTotal.labels(type).inc(delta);
      }
      this.lastSecurityEventCounts.set(type, count);
    }
  }

  private updateToolMetrics(): void {
    const registryMetrics = this.deps.registry.getMetrics();

    // Update tools registered gauge
    this.toolsRegistered.set(registryMetrics.totalTools);

    // Update per-tool call counts
    for (const toolName of registryMetrics.toolsRegistered) {
      const toolStats = this.deps.registry.getToolStats(toolName);
      if (toolStats) {
        const lastCount = this.lastToolCallCounts.get(toolName) || 0;
        const delta = toolStats.callCount - lastCount;
        if (delta > 0) {
          this.toolCallsTotal.labels(toolName).inc(delta);

          // Record execution times in histogram
          if (toolStats.averageExecutionTime > 0) {
            // We can only record the average here; for accurate histograms,
            // we'd need to instrument the actual tool execution
            this.requestDuration.labels(toolName).observe(toolStats.averageExecutionTime / 1000);
          }
        }
        this.lastToolCallCounts.set(toolName, toolStats.callCount);
      }
    }
  }

  private updateServicePoolMetrics(): void {
    const stats = this.deps.serviceFactory.getStats();

    this.servicePoolSize.set(stats.size);
    this.servicePoolMaxSize.set(stats.maxSize);
  }

  private updateStorageMetrics(): void {
    const stats = this.deps.lighthouseService.getStorageStats();

    this.storageFiles.set(stats.fileCount);
    this.storageBytes.set(stats.totalSize);
    this.storageMaxBytes.set(stats.maxSize);
    this.storageUtilization.set(stats.utilization);
  }

  /**
   * Get metrics in Prometheus text format
   */
  async getMetrics(): Promise<string> {
    // Update all metrics before export
    this.updateMetrics();

    // Return Prometheus text format
    return this.registry.metrics();
  }

  /**
   * Get content type for Prometheus response
   */
  getContentType(): string {
    return this.registry.contentType;
  }

  /**
   * Reset all custom metrics (useful for testing)
   */
  reset(): void {
    this.registry.resetMetrics();
    this.lastCacheCounters = { hits: 0, misses: 0 };
    this.lastAuthMetrics = {
      authenticatedRequests: 0,
      failedAuthentications: 0,
      fallbackRequests: 0,
    };
    this.lastSecurityEventCounts.clear();
    this.lastToolCallCounts.clear();
  }
}
