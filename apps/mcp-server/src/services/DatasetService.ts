/**
 * Dataset Service
 * Complete implementation of dataset management with versioning, parallel uploads,
 * and comprehensive error handling
 */

import { EventEmitter } from "eventemitter3";
import {
  Dataset,
  DatasetConfig,
  DatasetUpdate,
  DatasetFilter,
  DatasetStats,
  DatasetVersion,
  VersionChanges,
  VersionDiff,
  BatchUploadResult,
  UploadResult,
} from "@lighthouse-tooling/types";
import { Logger } from "@lighthouse-tooling/shared";
import { CIDGenerator } from "../utils/cid-generator.js";
import { ILighthouseService } from "./ILighthouseService.js";
import {
  IDatasetService,
  DatasetCreateOptions,
  BatchUploadOptions,
  DatasetServiceStats,
} from "./IDatasetService.js";
import { DatasetVersionManager } from "./DatasetVersionManager.js";
import { BatchUploadManager } from "./BatchUploadManager.js";

/**
 * Complete dataset service implementation with versioning and parallel processing
 */
export class DatasetService extends EventEmitter implements IDatasetService {
  private datasets: Map<string, Dataset> = new Map();
  private logger: Logger;
  private lighthouseService: ILighthouseService;
  private versionManager: DatasetVersionManager;
  private uploadManager: BatchUploadManager;

  constructor(lighthouseService: ILighthouseService, logger?: Logger) {
    super();
    this.lighthouseService = lighthouseService;
    this.logger = logger || Logger.getInstance({ level: "info", component: "DatasetService" });
    this.versionManager = new DatasetVersionManager(this.logger);
    this.uploadManager = new BatchUploadManager(this.lighthouseService, this.logger);

    // Forward upload progress events
    this.uploadManager.on("progress", (progress) => {
      this.emit("dataset:progress", progress);
    });

    this.logger.info("Dataset Service initialized");
  }

  /**
   * Create a new dataset with parallel file uploads
   */
  async createDataset(
    config: DatasetConfig,
    files: string[],
    options: DatasetCreateOptions = {},
  ): Promise<Dataset> {
    const startTime = Date.now();

    try {
      this.logger.info("Creating dataset", {
        name: config.name,
        fileCount: files.length,
        concurrency: options.concurrency || 5,
      });

      // Validate inputs
      this.validateDatasetConfig(config);
      this.validateFiles(files);

      // Check for duplicate name
      if (this.datasetExistsByName(config.name)) {
        throw new Error(`Dataset with name "${config.name}" already exists`);
      }

      // Emit start event
      this.emit("dataset:create:start", { name: config.name, fileCount: files.length });

      // Determine upload strategy based on file count
      const batchConfig = this.uploadManager.getOptimalBatchConfig(files.length);
      const uploadOptions: BatchUploadOptions = {
        concurrency: options.concurrency || batchConfig.concurrency,
        timeout: options.timeout,
        maxRetries: options.maxRetries,
        onProgress: options.onProgress,
        createVersion: false, // Will create initial version manually
      };

      // Upload files
      let batchResult: BatchUploadResult;
      if (batchConfig.useBatching && files.length >= 1000) {
        this.logger.info("Using batched upload for large dataset", {
          fileCount: files.length,
          batchSize: batchConfig.batchSize,
        });
        batchResult = await this.uploadManager.uploadFilesInBatches(
          files,
          {
            encrypt: config.encrypt,
            accessConditions: config.accessConditions,
            tags: config.tags,
          },
          { ...uploadOptions, batchSize: batchConfig.batchSize },
        );
      } else {
        batchResult = await this.uploadManager.uploadFiles(
          files,
          {
            encrypt: config.encrypt,
            accessConditions: config.accessConditions,
            tags: config.tags,
          },
          uploadOptions,
        );
      }

      // Check if we should continue despite failures
      if (batchResult.failed > 0) {
        this.logger.warn("Some files failed to upload", {
          successful: batchResult.successful,
          failed: batchResult.failed,
        });

        if (options.continueOnError === false && batchResult.failed > 0) {
          throw new Error(
            `Failed to upload ${batchResult.failed} files. Set continueOnError to true to create dataset with partial uploads.`,
          );
        }
      }

      // Generate dataset ID
      const datasetId = CIDGenerator.generate(`dataset-${config.name}-${Date.now()}`);

      // Create initial dataset object
      const dataset: Dataset = {
        id: datasetId,
        name: config.name,
        description: config.description || "",
        files: batchResult.successfulUploads,
        metadata: {
          author: config.metadata?.author,
          license: config.metadata?.license,
          category: config.metadata?.category,
          keywords: config.metadata?.keywords,
          custom: config.metadata?.custom,
        },
        version: "1.0.0",
        createdAt: new Date(),
        updatedAt: new Date(),
        encrypted: config.encrypt || false,
        accessConditions: config.accessConditions,
      };

      // Store dataset
      this.datasets.set(datasetId, dataset);

      // Create initial version
      const initialChanges: VersionChanges = {
        filesAdded: batchResult.successfulUploads.map((f) => f.cid),
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: `Initial dataset creation with ${batchResult.successful} files`,
      };

      await this.versionManager.createVersion(dataset, initialChanges, "system");

      const executionTime = Date.now() - startTime;

      this.logger.info("Dataset created successfully", {
        datasetId,
        name: config.name,
        fileCount: batchResult.successful,
        failedCount: batchResult.failed,
        executionTime,
        executionTimeMinutes: (executionTime / 1000 / 60).toFixed(2),
      });

      // Emit completion event
      this.emit("dataset:create:complete", {
        dataset,
        batchResult,
        executionTime,
      });

      return dataset;
    } catch (error) {
      this.logger.error("Dataset creation failed", error as Error, {
        name: config.name,
        fileCount: files.length,
      });

      this.emit("dataset:create:error", {
        name: config.name,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Get a dataset by ID, optionally at a specific version
   */
  async getDataset(datasetId: string, version?: string): Promise<Dataset> {
    try {
      const dataset = this.datasets.get(datasetId);
      if (!dataset) {
        throw new Error(`Dataset not found: ${datasetId}`);
      }

      // If version specified, get from version history
      if (version) {
        const versionRecord = this.versionManager.getVersion(datasetId, version);
        if (!versionRecord) {
          throw new Error(`Version ${version} not found for dataset ${datasetId}`);
        }

        // Reconstruct dataset from version snapshot
        return {
          ...dataset,
          files: versionRecord.snapshot.files,
          metadata: versionRecord.snapshot.metadata,
          version: versionRecord.version,
        };
      }

      return dataset;
    } catch (error) {
      this.logger.error("Failed to get dataset", error as Error, { datasetId, version });
      throw error;
    }
  }

  /**
   * Update an existing dataset
   */
  async updateDataset(datasetId: string, updates: DatasetUpdate): Promise<Dataset> {
    try {
      const dataset = this.datasets.get(datasetId);
      if (!dataset) {
        throw new Error(`Dataset not found: ${datasetId}`);
      }

      this.logger.info("Updating dataset", { datasetId, updates });

      // Track changes for versioning
      const changes: VersionChanges = {
        filesAdded: [],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "",
      };

      // Apply description update
      if (updates.description !== undefined) {
        dataset.description = updates.description;
        changes.configChanged = true;
      }

      // Apply metadata updates
      if (updates.metadata) {
        dataset.metadata = {
          ...dataset.metadata,
          ...updates.metadata,
          custom: {
            ...dataset.metadata.custom,
            ...updates.metadata.custom,
          },
        };
        changes.metadataChanged = true;
      }

      // Add files if specified
      if (updates.addFiles && updates.addFiles.length > 0) {
        const uploadResult = await this.uploadManager.uploadFiles(
          updates.addFiles,
          {
            encrypt: dataset.encrypted,
            accessConditions: dataset.accessConditions,
          },
          { continueOnError: true },
        );

        dataset.files.push(...uploadResult.successfulUploads);
        changes.filesAdded = uploadResult.successfulUploads.map((f) => f.cid);

        this.logger.info("Files added to dataset", {
          datasetId,
          added: uploadResult.successful,
          failed: uploadResult.failed,
        });
      }

      // Remove files if specified
      if (updates.removeFiles && updates.removeFiles.length > 0) {
        const removeSet = new Set(updates.removeFiles);
        const removedFiles = dataset.files.filter((f) => removeSet.has(f.cid));
        dataset.files = dataset.files.filter((f) => !removeSet.has(f.cid));
        changes.filesRemoved = removedFiles.map((f) => f.cid);

        this.logger.info("Files removed from dataset", {
          datasetId,
          removed: removedFiles.length,
        });
      }

      // Update tags
      if (updates.addTags || updates.removeTags) {
        const keywords = new Set(dataset.metadata.keywords || []);

        if (updates.addTags) {
          updates.addTags.forEach((tag) => keywords.add(tag));
        }

        if (updates.removeTags) {
          updates.removeTags.forEach((tag) => keywords.delete(tag));
        }

        dataset.metadata.keywords = Array.from(keywords);
        changes.metadataChanged = true;
      }

      // Update timestamp
      dataset.updatedAt = new Date();

      // Create summary of changes
      const changeParts: string[] = [];
      if (changes.filesAdded.length > 0)
        changeParts.push(`Added ${changes.filesAdded.length} files`);
      if (changes.filesRemoved.length > 0)
        changeParts.push(`Removed ${changes.filesRemoved.length} files`);
      if (changes.metadataChanged) changeParts.push("Updated metadata");
      if (changes.configChanged) changeParts.push("Updated configuration");

      changes.summary = changeParts.length > 0 ? changeParts.join(", ") : "No changes";

      // Create new version
      const newVersion = await this.versionManager.createVersion(dataset, changes, "user");
      dataset.version = newVersion.version;

      this.logger.info("Dataset updated successfully", {
        datasetId,
        newVersion: dataset.version,
        changes: changes.summary,
      });

      return dataset;
    } catch (error) {
      this.logger.error("Failed to update dataset", error as Error, { datasetId });
      throw error;
    }
  }

  /**
   * List datasets with filtering
   */
  async listDatasets(filter?: DatasetFilter): Promise<Dataset[]> {
    let datasets = Array.from(this.datasets.values());

    if (filter) {
      // Filter by encryption
      if (filter.encrypted !== undefined) {
        datasets = datasets.filter((d) => d.encrypted === filter.encrypted);
      }

      // Filter by name pattern
      if (filter.namePattern) {
        const pattern = new RegExp(filter.namePattern, "i");
        datasets = datasets.filter((d) => pattern.test(d.name));
      }

      // Filter by tags
      if (filter.tags && filter.tags.length > 0) {
        datasets = datasets.filter((d) =>
          filter.tags!.some((tag) => d.metadata.keywords?.includes(tag)),
        );
      }

      // Filter by author
      if (filter.author) {
        datasets = datasets.filter((d) => d.metadata.author === filter.author);
      }

      // Filter by category
      if (filter.category) {
        datasets = datasets.filter((d) => d.metadata.category === filter.category);
      }

      // Filter by creation date
      if (filter.createdAfter) {
        datasets = datasets.filter((d) => d.createdAt >= filter.createdAfter!);
      }

      if (filter.createdBefore) {
        datasets = datasets.filter((d) => d.createdAt <= filter.createdBefore!);
      }

      // Filter by file count
      if (filter.minFiles !== undefined) {
        datasets = datasets.filter((d) => d.files.length >= filter.minFiles!);
      }

      if (filter.maxFiles !== undefined) {
        datasets = datasets.filter((d) => d.files.length <= filter.maxFiles!);
      }

      // Apply pagination
      const offset = filter.offset || 0;
      const limit = filter.limit || datasets.length;
      datasets = datasets.slice(offset, offset + limit);
    }

    return datasets;
  }

  /**
   * Delete a dataset
   */
  async deleteDataset(datasetId: string): Promise<boolean> {
    try {
      const dataset = this.datasets.get(datasetId);
      if (!dataset) {
        return false;
      }

      // Delete dataset
      this.datasets.delete(datasetId);

      // Clear version history
      this.versionManager.clearDatasetVersions(datasetId);

      this.logger.info("Dataset deleted", { datasetId, name: dataset.name });

      return true;
    } catch (error) {
      this.logger.error("Failed to delete dataset", error as Error, { datasetId });
      throw error;
    }
  }

  /**
   * Create a new version
   */
  async createVersion(datasetId: string, changes: VersionChanges): Promise<DatasetVersion> {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    return this.versionManager.createVersion(dataset, changes);
  }

  /**
   * List all versions of a dataset
   */
  async listVersions(datasetId: string): Promise<DatasetVersion[]> {
    return this.versionManager.listVersions(datasetId);
  }

  /**
   * Rollback to a previous version
   */
  async rollbackToVersion(datasetId: string, version: string): Promise<Dataset> {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    const rolledBack = await this.versionManager.rollbackToVersion(dataset, version);

    // Update stored dataset
    this.datasets.set(datasetId, rolledBack);

    return rolledBack;
  }

  /**
   * Compare versions
   */
  async compareVersions(
    datasetId: string,
    fromVersion: string,
    toVersion: string,
  ): Promise<VersionDiff> {
    return this.versionManager.compareVersions(datasetId, fromVersion, toVersion);
  }

  /**
   * Add files to a dataset
   */
  async addFilesToDataset(
    datasetId: string,
    files: string[],
    options?: BatchUploadOptions,
  ): Promise<BatchUploadResult> {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    const batchResult = await this.uploadManager.uploadFiles(
      files,
      {
        encrypt: dataset.encrypted,
        accessConditions: dataset.accessConditions,
      },
      options || {},
    );

    // Add successful uploads to dataset
    dataset.files.push(...batchResult.successfulUploads);
    dataset.updatedAt = new Date();

    // Create new version if requested
    if (options?.createVersion !== false) {
      const changes: VersionChanges = {
        filesAdded: batchResult.successfulUploads.map((f) => f.cid),
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: `Added ${batchResult.successful} files`,
      };

      const newVersion = await this.versionManager.createVersion(dataset, changes);
      dataset.version = newVersion.version;
    }

    return batchResult;
  }

  /**
   * Remove files from a dataset
   */
  async removeFilesFromDataset(datasetId: string, cids: string[]): Promise<Dataset> {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    const removeSet = new Set(cids);
    const removedFiles = dataset.files.filter((f) => removeSet.has(f.cid));
    dataset.files = dataset.files.filter((f) => !removeSet.has(f.cid));
    dataset.updatedAt = new Date();

    // Create new version
    const changes: VersionChanges = {
      filesAdded: [],
      filesRemoved: removedFiles.map((f) => f.cid),
      filesModified: [],
      metadataChanged: false,
      configChanged: false,
      summary: `Removed ${removedFiles.length} files`,
    };

    const newVersion = await this.versionManager.createVersion(dataset, changes);
    dataset.version = newVersion.version;

    return dataset;
  }

  /**
   * Get dataset statistics
   */
  async getDatasetStats(datasetId: string): Promise<DatasetStats> {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    const fileSizes = dataset.files.map((f) => f.size);
    const totalSize = fileSizes.reduce((sum, size) => sum + size, 0);
    const averageFileSize = fileSizes.length > 0 ? totalSize / fileSizes.length : 0;
    const largestFileSize = fileSizes.length > 0 ? Math.max(...fileSizes) : 0;
    const smallestFileSize = fileSizes.length > 0 ? Math.min(...fileSizes) : 0;

    return {
      id: dataset.id,
      name: dataset.name,
      fileCount: dataset.files.length,
      totalSize,
      encrypted: dataset.encrypted,
      version: dataset.version,
      versionCount: this.versionManager.getVersionCount(datasetId),
      createdAt: dataset.createdAt,
      updatedAt: dataset.updatedAt,
      averageFileSize,
      largestFileSize,
      smallestFileSize,
    };
  }

  /**
   * Get overall service statistics
   */
  getAllStats(): DatasetServiceStats {
    const datasets = Array.from(this.datasets.values());
    const totalFiles = datasets.reduce((sum, d) => sum + d.files.length, 0);
    const totalSize = datasets.reduce((sum, d) => sum + d.files.reduce((s, f) => s + f.size, 0), 0);
    const encryptedDatasets = datasets.filter((d) => d.encrypted).length;

    return {
      totalDatasets: datasets.length,
      totalFiles,
      totalSize,
      encryptedDatasets,
      totalVersions: this.versionManager.getTotalVersionCount(),
      averageFilesPerDataset: datasets.length > 0 ? totalFiles / datasets.length : 0,
      averageDatasetSize: datasets.length > 0 ? totalSize / datasets.length : 0,
    };
  }

  /**
   * Clear all datasets
   */
  clear(): void {
    this.datasets.clear();
    this.versionManager.clear();
    this.logger.info("All datasets cleared");
  }

  /**
   * Validate dataset configuration
   */
  private validateDatasetConfig(config: DatasetConfig): void {
    if (!config.name || config.name.trim().length === 0) {
      throw new Error("Dataset name is required");
    }

    if (config.name.length > 255) {
      throw new Error("Dataset name must be less than 255 characters");
    }
  }

  /**
   * Validate files array
   */
  private validateFiles(files: string[]): void {
    if (!files || files.length === 0) {
      throw new Error("At least one file is required");
    }

    if (files.length > 10000) {
      throw new Error("Maximum 10,000 files per dataset");
    }
  }

  /**
   * Check if dataset exists by name
   */
  private datasetExistsByName(name: string): boolean {
    return Array.from(this.datasets.values()).some((d) => d.name === name);
  }
}
