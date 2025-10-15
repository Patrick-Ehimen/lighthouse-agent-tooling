/**
 * Mock Dataset Service - Simulates dataset management operations
 */

import { Dataset, DatasetConfig, UploadResult } from "@lighthouse-tooling/types";
import { Logger } from "@lighthouse-tooling/shared";
import { CIDGenerator } from "../utils/cid-generator.js";
import { MockLighthouseService } from "./MockLighthouseService.js";

export class MockDatasetService {
  private datasets: Map<string, Dataset> = new Map();
  private logger: Logger;
  private lighthouseService: MockLighthouseService;

  constructor(lighthouseService: MockLighthouseService, logger?: Logger) {
    this.lighthouseService = lighthouseService;
    this.logger = logger || Logger.getInstance({ level: "info", component: "MockDatasetService" });
    this.logger.info("Mock Dataset Service initialized");
  }

  /**
   * Create a new dataset
   */
  async createDataset(params: {
    name: string;
    description?: string;
    files: string[];
    metadata?: Record<string, unknown>;
    encrypt?: boolean;
    accessConditions?: any[];
    tags?: string[];
  }): Promise<Dataset> {
    const startTime = Date.now();

    try {
      this.logger.info("Creating dataset", { name: params.name, fileCount: params.files.length });

      // Validate inputs
      if (!params.name || params.name.trim().length === 0) {
        throw new Error("Dataset name is required");
      }

      if (!params.files || params.files.length === 0) {
        throw new Error("At least one file is required");
      }

      // Check if dataset already exists
      const existingDataset = Array.from(this.datasets.values()).find(
        (d) => d.name === params.name,
      );
      if (existingDataset) {
        throw new Error(`Dataset with name "${params.name}" already exists`);
      }

      // Upload all files
      const uploadResults: UploadResult[] = [];
      for (const filePath of params.files) {
        try {
          const result = await this.lighthouseService.uploadFile({
            filePath,
            encrypt: params.encrypt,
            accessConditions: params.accessConditions,
            tags: params.tags,
          });
          uploadResults.push(result);
        } catch (error) {
          this.logger.error("Failed to upload file in dataset", error as Error, { filePath });
          throw new Error(`Failed to upload file: ${filePath}`);
        }
      }

      // Generate dataset ID (CID of metadata)
      const datasetId = CIDGenerator.generate(`dataset-${params.name}-${Date.now()}`);

      // Create dataset object
      const dataset: Dataset = {
        id: datasetId,
        name: params.name,
        description: params.description || "",
        files: uploadResults,
        metadata: {
          author: params.metadata?.author as string | undefined,
          license: params.metadata?.license as string | undefined,
          category: params.metadata?.category as string | undefined,
          keywords: params.metadata?.keywords as string[] | undefined,
          custom: params.metadata,
        },
        version: "1.0.0",
        createdAt: new Date(),
        updatedAt: new Date(),
        encrypted: params.encrypt || false,
        accessConditions: params.accessConditions,
      };

      // Store dataset
      this.datasets.set(datasetId, dataset);

      const executionTime = Date.now() - startTime;
      this.logger.info("Dataset created successfully", {
        datasetId,
        name: params.name,
        fileCount: uploadResults.length,
        executionTime,
      });

      return dataset;
    } catch (error) {
      this.logger.error("Dataset creation failed", error as Error, { name: params.name });
      throw error;
    }
  }

  /**
   * Get dataset by ID
   */
  getDataset(datasetId: string): Dataset | undefined {
    return this.datasets.get(datasetId);
  }

  /**
   * List all datasets
   */
  listDatasets(filter?: { encrypted?: boolean; namePattern?: string; tags?: string[] }): Dataset[] {
    let datasets = Array.from(this.datasets.values());

    if (filter) {
      if (filter.encrypted !== undefined) {
        datasets = datasets.filter((d) => d.encrypted === filter.encrypted);
      }

      if (filter.namePattern) {
        const pattern = new RegExp(filter.namePattern, "i");
        datasets = datasets.filter((d) => pattern.test(d.name));
      }

      if (filter.tags && filter.tags.length > 0) {
        datasets = datasets.filter((d) =>
          d.files.some((f: any) => f.tags?.some((tag: string) => filter.tags!.includes(tag))),
        );
      }
    }

    return datasets;
  }

  /**
   * Update dataset metadata
   */
  async updateDataset(
    datasetId: string,
    updates: {
      description?: string;
      metadata?: Record<string, unknown>;
      version?: string;
    },
  ): Promise<Dataset> {
    try {
      const dataset = this.datasets.get(datasetId);
      if (!dataset) {
        throw new Error(`Dataset not found: ${datasetId}`);
      }

      // Apply updates
      if (updates.description !== undefined) {
        dataset.description = updates.description;
      }

      if (updates.metadata) {
        dataset.metadata = {
          ...dataset.metadata,
          custom: { ...dataset.metadata.custom, ...updates.metadata },
        };
      }

      if (updates.version) {
        dataset.version = updates.version;
      }

      dataset.updatedAt = new Date();

      this.logger.info("Dataset updated", { datasetId });

      return dataset;
    } catch (error) {
      this.logger.error("Dataset update failed", error as Error, { datasetId });
      throw error;
    }
  }

  /**
   * Add files to existing dataset
   */
  async addFilesToDataset(datasetId: string, files: string[]): Promise<Dataset> {
    try {
      const dataset = this.datasets.get(datasetId);
      if (!dataset) {
        throw new Error(`Dataset not found: ${datasetId}`);
      }

      // Upload new files
      const uploadResults: UploadResult[] = [];
      for (const filePath of files) {
        const result = await this.lighthouseService.uploadFile({
          filePath,
          encrypt: dataset.encrypted,
          accessConditions: dataset.accessConditions,
        });
        uploadResults.push(result);
      }

      // Add to dataset
      dataset.files.push(...uploadResults);
      dataset.updatedAt = new Date();

      this.logger.info("Files added to dataset", {
        datasetId,
        newFileCount: uploadResults.length,
      });

      return dataset;
    } catch (error) {
      this.logger.error("Failed to add files to dataset", error as Error, { datasetId });
      throw error;
    }
  }

  /**
   * Delete dataset
   */
  deleteDataset(datasetId: string): boolean {
    const result = this.datasets.delete(datasetId);
    if (result) {
      this.logger.info("Dataset deleted", { datasetId });
    }
    return result;
  }

  /**
   * Get dataset statistics
   */
  getDatasetStats(datasetId: string):
    | {
        fileCount: number;
        totalSize: number;
        encrypted: boolean;
        createdAt: Date;
        updatedAt: Date;
      }
    | undefined {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) return undefined;

    const totalSize = dataset.files.reduce((sum, file) => sum + file.size, 0);

    return {
      fileCount: dataset.files.length,
      totalSize,
      encrypted: dataset.encrypted,
      createdAt: dataset.createdAt,
      updatedAt: dataset.updatedAt,
    };
  }

  /**
   * Get all datasets statistics
   */
  getAllStats(): {
    totalDatasets: number;
    totalFiles: number;
    totalSize: number;
    encryptedDatasets: number;
  } {
    const datasets = Array.from(this.datasets.values());

    return {
      totalDatasets: datasets.length,
      totalFiles: datasets.reduce((sum: number, d: any) => sum + d.files.length, 0),
      totalSize: datasets.reduce(
        (sum: number, d: any) => sum + d.files.reduce((s: number, f: any) => s + f.size, 0),
        0,
      ),
      encryptedDatasets: datasets.filter((d: any) => d.encrypted).length,
    };
  }

  /**
   * Clear all datasets (for testing)
   */
  clear(): void {
    this.datasets.clear();
    this.logger.info("All datasets cleared");
  }
}
