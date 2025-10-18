/**
 * Lighthouse Dataset Version Tool
 * MCP tool for dataset version management (list, compare, rollback)
 */

import { Logger } from "@lighthouse-tooling/shared";
import { MCPToolDefinition, ExecutionTimeCategory } from "@lighthouse-tooling/types";
import { IDatasetService } from "../services/IDatasetService.js";
import { ProgressAwareToolResult } from "./types.js";

interface VersionToolParams {
  operation: "list" | "compare" | "rollback" | "stats";
  datasetId: string;
  version?: string;
  fromVersion?: string;
  toVersion?: string;
}

export class LighthouseDatasetVersionTool {
  private service: IDatasetService;
  private logger: Logger;

  constructor(service: IDatasetService, logger?: Logger) {
    this.service = service;
    this.logger =
      logger || Logger.getInstance({ level: "info", component: "LighthouseDatasetVersionTool" });
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse_dataset_version",
      description:
        "Manage dataset versions: list all versions, compare versions, rollback to previous version, or get version statistics. Supports semantic versioning with change tracking.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            description: "Operation to perform",
            enum: ["list", "compare", "rollback", "stats"],
          },
          datasetId: {
            type: "string",
            description: "Unique identifier of the dataset",
            minLength: 1,
          },
          version: {
            type: "string",
            description:
              'Target version for rollback operation (e.g., "1.0.0"). Required for rollback.',
          },
          fromVersion: {
            type: "string",
            description: 'Starting version for comparison (e.g., "1.0.0"). Required for compare.',
          },
          toVersion: {
            type: "string",
            description: 'Ending version for comparison (e.g., "2.0.0"). Required for compare.',
          },
        },
        required: ["operation", "datasetId"],
        additionalProperties: false,
      },
      requiresAuth: true,
      supportsBatch: false,
      executionTime: ExecutionTimeCategory.FAST,
    };
  }

  async execute(args: Record<string, unknown>): Promise<ProgressAwareToolResult> {
    const startTime = Date.now();

    try {
      const params: VersionToolParams = {
        operation: args.operation as VersionToolParams["operation"],
        datasetId: args.datasetId as string,
        version: args.version as string | undefined,
        fromVersion: args.fromVersion as string | undefined,
        toVersion: args.toVersion as string | undefined,
      };

      // Validate required params
      if (!params.operation) {
        return {
          success: false,
          error: "operation is required",
          executionTime: Date.now() - startTime,
        };
      }

      if (!params.datasetId) {
        return {
          success: false,
          error: "datasetId is required",
          executionTime: Date.now() - startTime,
        };
      }

      // Route to appropriate operation
      switch (params.operation) {
        case "list":
          return await this.listVersions(params, startTime);
        case "compare":
          return await this.compareVersions(params, startTime);
        case "rollback":
          return await this.rollbackVersion(params, startTime);
        case "stats":
          return await this.getVersionStats(params, startTime);
        default:
          return {
            success: false,
            error: `Unknown operation: ${params.operation}`,
            executionTime: Date.now() - startTime,
          };
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error("Version operation failed", error as Error, { args });
      return {
        success: false,
        error: (error as Error).message,
        executionTime,
      };
    }
  }

  private async listVersions(
    params: VersionToolParams,
    startTime: number,
  ): Promise<ProgressAwareToolResult> {
    const versions = await this.service.listVersions(params.datasetId);
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: {
        datasetId: params.datasetId,
        versionCount: versions.length,
        versions: versions.map((v) => ({
          id: v.id,
          version: v.version,
          createdAt: v.createdAt.toISOString(),
          createdBy: v.createdBy,
          changeDescription: v.changeDescription,
          changes: {
            filesAdded: v.changes.filesAdded.length,
            filesRemoved: v.changes.filesRemoved.length,
            filesModified: v.changes.filesModified.length,
            metadataChanged: v.changes.metadataChanged,
            summary: v.changes.summary,
          },
          snapshot: {
            fileCount: v.snapshot.fileCount,
            totalSize: v.snapshot.totalSize,
          },
        })),
      },
      executionTime,
    };
  }

  private async compareVersions(
    params: VersionToolParams,
    startTime: number,
  ): Promise<ProgressAwareToolResult> {
    if (!params.fromVersion || !params.toVersion) {
      return {
        success: false,
        error: "fromVersion and toVersion are required for compare operation",
        executionTime: Date.now() - startTime,
      };
    }

    const diff = await this.service.compareVersions(
      params.datasetId,
      params.fromVersion,
      params.toVersion,
    );
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: {
        datasetId: params.datasetId,
        fromVersion: diff.fromVersion,
        toVersion: diff.toVersion,
        summary: diff.summary,
        filesAdded: diff.filesAdded.length,
        filesRemoved: diff.filesRemoved.length,
        filesModified: diff.filesModified.length,
        metadataChanges: Object.keys(diff.metadataChanges).length,
        details: {
          addedFiles: diff.filesAdded.map((f) => ({
            cid: f.cid,
            size: f.size,
            originalPath: f.originalPath,
          })),
          removedFiles: diff.filesRemoved.map((f) => ({
            cid: f.cid,
            size: f.size,
            originalPath: f.originalPath,
          })),
          modifiedFiles: diff.filesModified.map((f) => ({
            cid: f.cid,
            size: f.size,
            originalPath: f.originalPath,
          })),
          metadataChanges: diff.metadataChanges,
        },
      },
      executionTime,
    };
  }

  private async rollbackVersion(
    params: VersionToolParams,
    startTime: number,
  ): Promise<ProgressAwareToolResult> {
    if (!params.version) {
      return {
        success: false,
        error: "version is required for rollback operation",
        executionTime: Date.now() - startTime,
      };
    }

    const dataset = await this.service.rollbackToVersion(params.datasetId, params.version);
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: {
        datasetId: dataset.id,
        name: dataset.name,
        rolledBackTo: params.version,
        currentVersion: dataset.version,
        fileCount: dataset.files.length,
        totalSize: dataset.files.reduce((sum, f) => sum + f.size, 0),
        updatedAt: dataset.updatedAt.toISOString(),
        message: `Successfully rolled back to version ${params.version}. Current version is now ${dataset.version}`,
      },
      executionTime,
      metadata: {
        rolledBackTo: params.version,
        newVersion: dataset.version,
      },
    };
  }

  private async getVersionStats(
    params: VersionToolParams,
    startTime: number,
  ): Promise<ProgressAwareToolResult> {
    const stats = await this.service.getDatasetStats(params.datasetId);
    const versions = await this.service.listVersions(params.datasetId);
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: {
        datasetId: params.datasetId,
        name: stats.name,
        currentVersion: stats.version,
        versionCount: stats.versionCount,
        versions: versions.map((v) => ({
          version: v.version,
          createdAt: v.createdAt.toISOString(),
          fileCount: v.snapshot.fileCount,
          totalSize: v.snapshot.totalSize,
          changes: v.changes.summary,
        })),
        stats: {
          fileCount: stats.fileCount,
          totalSize: stats.totalSize,
          averageFileSize: stats.averageFileSize,
          largestFileSize: stats.largestFileSize,
          smallestFileSize: stats.smallestFileSize,
        },
      },
      executionTime,
    };
  }
}
