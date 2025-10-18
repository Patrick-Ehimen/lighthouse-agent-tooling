/**
 * Lighthouse List Datasets Tool
 * MCP tool for listing datasets with filtering and pagination
 */

import { Logger } from "@lighthouse-tooling/shared";
import { MCPToolDefinition, ExecutionTimeCategory, DatasetFilter } from "@lighthouse-tooling/types";
import { IDatasetService } from "../services/IDatasetService.js";
import { ProgressAwareToolResult } from "./types.js";

export class LighthouseListDatasetsTool {
  private service: IDatasetService;
  private logger: Logger;

  constructor(service: IDatasetService, logger?: Logger) {
    this.service = service;
    this.logger =
      logger || Logger.getInstance({ level: "info", component: "LighthouseListDatasetsTool" });
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse_list_datasets",
      description:
        "List all datasets with optional filtering by encryption, tags, author, category, date range, and file count. Supports pagination.",
      inputSchema: {
        type: "object",
        properties: {
          encrypted: {
            type: "boolean",
            description: "Filter by encryption status",
          },
          namePattern: {
            type: "string",
            description: "Filter by name pattern (regex)",
          },
          tags: {
            type: "array",
            description: "Filter by tags (datasets must have at least one matching tag)",
            items: { type: "string", description: "Tag" },
          },
          author: {
            type: "string",
            description: "Filter by author",
          },
          category: {
            type: "string",
            description: "Filter by category",
          },
          minFiles: {
            type: "number",
            description: "Minimum number of files",
            minimum: 0,
          },
          maxFiles: {
            type: "number",
            description: "Maximum number of files",
            minimum: 0,
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return",
            default: 100,
            minimum: 1,
            maximum: 1000,
          },
          offset: {
            type: "number",
            description: "Number of results to skip (for pagination)",
            default: 0,
            minimum: 0,
          },
        },
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
      const filter: DatasetFilter = {
        encrypted: args.encrypted as boolean | undefined,
        namePattern: args.namePattern as string | undefined,
        tags: args.tags as string[] | undefined,
        author: args.author as string | undefined,
        category: args.category as string | undefined,
        minFiles: args.minFiles as number | undefined,
        maxFiles: args.maxFiles as number | undefined,
        limit: (args.limit as number) || 100,
        offset: (args.offset as number) || 0,
      };

      const datasets = await this.service.listDatasets(filter);
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          datasets: datasets.map((d) => ({
            id: d.id,
            name: d.name,
            description: d.description,
            version: d.version,
            fileCount: d.files.length,
            totalSize: d.files.reduce((sum, f) => sum + f.size, 0),
            encrypted: d.encrypted,
            author: d.metadata.author,
            category: d.metadata.category,
            keywords: d.metadata.keywords,
            createdAt: d.createdAt.toISOString(),
            updatedAt: d.updatedAt.toISOString(),
          })),
          count: datasets.length,
          filter: {
            limit: filter.limit,
            offset: filter.offset,
          },
        },
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error("Failed to list datasets", error as Error, { args });
      return {
        success: false,
        error: (error as Error).message,
        executionTime,
      };
    }
  }
}
