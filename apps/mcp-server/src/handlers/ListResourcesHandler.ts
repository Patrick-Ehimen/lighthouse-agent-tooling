/**
 * ListResourcesHandler - Handles resources/list requests
 */

import { Logger } from "@lighthouse-tooling/shared";
import { MCPResponse } from "@lighthouse-tooling/types";
import { ResponseBuilder } from "../utils/response-builder.js";
import { MockLighthouseService } from "../services/MockLighthouseService.js";
import { MockDatasetService } from "../services/MockDatasetService.js";

export class ListResourcesHandler {
  private lighthouseService: MockLighthouseService;
  private datasetService: MockDatasetService;
  private logger: Logger;

  constructor(
    lighthouseService: MockLighthouseService,
    datasetService: MockDatasetService,
    logger?: Logger,
  ) {
    this.lighthouseService = lighthouseService;
    this.datasetService = datasetService;
    this.logger =
      logger || Logger.getInstance({ level: "info", component: "ListResourcesHandler" });
  }

  /**
   * Handle resources/list request
   */
  async handle(requestId: string | number): Promise<MCPResponse> {
    try {
      this.logger.info("Handling resources/list request", { requestId });

      // Get all uploaded files
      const files = this.lighthouseService.listFiles();

      // Get all datasets
      const datasets = this.datasetService.listDatasets();

      // Format as resources
      const resources = [
        ...files.map((file) => ({
          uri: `lighthouse://file/${file.cid}`,
          name: file.filePath,
          description: `Uploaded file: ${file.filePath}`,
          mimeType: "application/octet-stream",
          metadata: {
            cid: file.cid,
            size: file.size,
            encrypted: file.encrypted,
            uploadedAt: file.uploadedAt,
            pinned: file.pinned,
          },
        })),
        ...datasets.map((dataset) => ({
          uri: `lighthouse://dataset/${dataset.id}`,
          name: dataset.name,
          description: dataset.description || `Dataset: ${dataset.name}`,
          mimeType: "application/json",
          metadata: {
            id: dataset.id,
            fileCount: dataset.files.length,
            encrypted: dataset.encrypted,
            version: dataset.version,
            createdAt: dataset.createdAt,
          },
        })),
      ];

      this.logger.info("Resources list returned", {
        requestId,
        fileCount: files.length,
        datasetCount: datasets.length,
        totalResources: resources.length,
      });

      return ResponseBuilder.resourceList(requestId, resources);
    } catch (error) {
      this.logger.error("Failed to list resources", error as Error, { requestId });
      return ResponseBuilder.fromError(requestId, error as Error);
    }
  }
}
