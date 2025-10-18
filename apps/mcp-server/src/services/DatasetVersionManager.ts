/**
 * Dataset Version Manager
 * Handles semantic versioning, version history, and rollback capabilities for datasets
 */

import {
  Dataset,
  DatasetVersion,
  VersionChanges,
  DatasetSnapshot,
  VersionDiff,
  DatasetMetadata,
  DatasetConfig,
  UploadResult,
} from "@lighthouse-tooling/types";
import { Logger } from "@lighthouse-tooling/shared";
import { CIDGenerator } from "../utils/cid-generator.js";

/**
 * Manages dataset versioning with semantic versioning support
 */
export class DatasetVersionManager {
  private versions: Map<string, DatasetVersion[]> = new Map(); // datasetId -> versions array
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger =
      logger || Logger.getInstance({ level: "info", component: "DatasetVersionManager" });
    this.logger.info("Dataset Version Manager initialized");
  }

  /**
   * Create a new version for a dataset
   */
  async createVersion(
    dataset: Dataset,
    changes: VersionChanges,
    createdBy?: string,
  ): Promise<DatasetVersion> {
    try {
      this.logger.info("Creating new version", {
        datasetId: dataset.id,
        currentVersion: dataset.version,
      });

      // Get existing versions for this dataset
      const existingVersions = this.versions.get(dataset.id) || [];

      // Parse current version
      const currentVersion = this.parseVersion(dataset.version);

      // Determine new version based on changes
      const newVersion = this.bumpVersion(currentVersion, changes);
      const versionString = this.formatVersion(newVersion);

      // Create snapshot of current dataset state
      const snapshot = this.createSnapshot(dataset);

      // Create version record
      const version: DatasetVersion = {
        id: CIDGenerator.generate(`version-${dataset.id}-${versionString}-${Date.now()}`),
        datasetId: dataset.id,
        version: versionString,
        changes,
        snapshot,
        createdAt: new Date(),
        createdBy,
        changeDescription: changes.summary,
        tags: [],
      };

      // Store version
      existingVersions.push(version);
      this.versions.set(dataset.id, existingVersions);

      this.logger.info("Version created successfully", {
        datasetId: dataset.id,
        version: versionString,
        versionId: version.id,
      });

      return version;
    } catch (error) {
      this.logger.error("Failed to create version", error as Error, {
        datasetId: dataset.id,
      });
      throw error;
    }
  }

  /**
   * Get all versions for a dataset
   */
  listVersions(datasetId: string): DatasetVersion[] {
    const versions = this.versions.get(datasetId) || [];
    // Return sorted by version (newest first)
    return versions.sort((a, b) => {
      const versionA = this.parseVersion(a.version);
      const versionB = this.parseVersion(b.version);
      return this.compareVersionTuples(versionB, versionA);
    });
  }

  /**
   * Get a specific version
   */
  getVersion(datasetId: string, versionString: string): DatasetVersion | undefined {
    const versions = this.versions.get(datasetId) || [];
    return versions.find((v) => v.version === versionString);
  }

  /**
   * Rollback dataset to a previous version
   */
  async rollbackToVersion(dataset: Dataset, targetVersion: string): Promise<Dataset> {
    try {
      this.logger.info("Rolling back dataset", {
        datasetId: dataset.id,
        fromVersion: dataset.version,
        toVersion: targetVersion,
      });

      const version = this.getVersion(dataset.id, targetVersion);
      if (!version) {
        throw new Error(`Version ${targetVersion} not found for dataset ${dataset.id}`);
      }

      // Create changes record for the rollback
      const changes = this.computeChangesForRollback(dataset, version.snapshot);

      // Create a new version for the rollback action
      const rollbackVersion = await this.createVersion(dataset, changes, "system");

      // Restore dataset state from snapshot
      const restoredDataset: Dataset = {
        ...dataset,
        files: [...version.snapshot.files],
        metadata: { ...version.snapshot.metadata },
        version: rollbackVersion.version,
        updatedAt: new Date(),
      };

      this.logger.info("Rollback completed", {
        datasetId: dataset.id,
        restoredToVersion: targetVersion,
        newVersion: rollbackVersion.version,
      });

      return restoredDataset;
    } catch (error) {
      this.logger.error("Rollback failed", error as Error, {
        datasetId: dataset.id,
        targetVersion,
      });
      throw error;
    }
  }

  /**
   * Compare two versions and return differences
   */
  compareVersions(
    datasetId: string,
    fromVersionString: string,
    toVersionString: string,
  ): VersionDiff {
    const fromVersion = this.getVersion(datasetId, fromVersionString);
    const toVersion = this.getVersion(datasetId, toVersionString);

    if (!fromVersion || !toVersion) {
      throw new Error(`One or both versions not found: ${fromVersionString}, ${toVersionString}`);
    }

    const fromFiles = new Map(fromVersion.snapshot.files.map((f) => [f.cid, f]));
    const toFiles = new Map(toVersion.snapshot.files.map((f) => [f.cid, f]));

    // Find added files
    const filesAdded: UploadResult[] = [];
    toFiles.forEach((file, cid) => {
      if (!fromFiles.has(cid)) {
        filesAdded.push(file);
      }
    });

    // Find removed files
    const filesRemoved: UploadResult[] = [];
    fromFiles.forEach((file, cid) => {
      if (!toFiles.has(cid)) {
        filesRemoved.push(file);
      }
    });

    // Find modified files (same CID but different metadata)
    const filesModified: UploadResult[] = [];
    toFiles.forEach((file, cid) => {
      const oldFile = fromFiles.get(cid);
      if (oldFile && JSON.stringify(oldFile) !== JSON.stringify(file)) {
        filesModified.push(file);
      }
    });

    // Compare metadata
    const metadataChanges = this.computeMetadataChanges(
      fromVersion.snapshot.metadata,
      toVersion.snapshot.metadata,
    );

    // Generate summary
    const summary = this.generateDiffSummary(
      filesAdded.length,
      filesRemoved.length,
      filesModified.length,
      Object.keys(metadataChanges).length,
    );

    return {
      fromVersion: fromVersionString,
      toVersion: toVersionString,
      filesAdded,
      filesRemoved,
      filesModified,
      metadataChanges,
      summary,
    };
  }

  /**
   * Parse semantic version string to tuple
   */
  private parseVersion(versionString: string): [number, number, number] {
    const parts = versionString.split(".");
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      throw new Error(`Invalid version format: ${versionString}`);
    }

    const major = parseInt(parts[0], 10);
    const minor = parseInt(parts[1], 10);
    const patch = parseInt(parts[2], 10);

    if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
      throw new Error(`Invalid version numbers: ${versionString}`);
    }

    return [major, minor, patch];
  }

  /**
   * Format version tuple to string
   */
  private formatVersion(version: [number, number, number]): string {
    return `${version[0]}.${version[1]}.${version[2]}`;
  }

  /**
   * Bump version based on changes according to semantic versioning
   */
  private bumpVersion(
    current: [number, number, number],
    changes: VersionChanges,
  ): [number, number, number] {
    const [major, minor, patch] = current;

    // Major version bump: Breaking changes (files removed or significant changes)
    if (changes.filesRemoved.length > 0) {
      return [major + 1, 0, 0];
    }

    // Minor version bump: New features (files added)
    if (changes.filesAdded.length > 0) {
      return [major, minor + 1, 0];
    }

    // Patch version bump: Bug fixes, metadata changes, file modifications
    if (changes.filesModified.length > 0 || changes.metadataChanged || changes.configChanged) {
      return [major, minor, patch + 1];
    }

    // If no changes, still bump patch version
    return [major, minor, patch + 1];
  }

  /**
   * Compare two version tuples
   * Returns: negative if a < b, 0 if equal, positive if a > b
   */
  private compareVersionTuples(a: [number, number, number], b: [number, number, number]): number {
    if (a[0] !== b[0]) return a[0] - b[0];
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[2] - b[2];
  }

  /**
   * Create a snapshot of dataset state
   */
  private createSnapshot(dataset: Dataset): DatasetSnapshot {
    const totalSize = dataset.files.reduce((sum, file) => sum + file.size, 0);

    return {
      files: dataset.files.map((file) => ({ ...file })),
      metadata: { ...dataset.metadata },
      config: {
        name: dataset.name,
        description: dataset.description,
        encrypt: dataset.encrypted,
        accessConditions: dataset.accessConditions,
        tags: dataset.metadata.keywords || [],
      },
      totalSize,
      fileCount: dataset.files.length,
    };
  }

  /**
   * Compute changes needed for rollback
   */
  private computeChangesForRollback(
    currentDataset: Dataset,
    targetSnapshot: DatasetSnapshot,
  ): VersionChanges {
    const currentCIDs = new Set(currentDataset.files.map((f) => f.cid));
    const targetCIDs = new Set(targetSnapshot.files.map((f) => f.cid));

    const filesAdded: string[] = [];
    targetCIDs.forEach((cid) => {
      if (!currentCIDs.has(cid)) {
        filesAdded.push(cid);
      }
    });

    const filesRemoved: string[] = [];
    currentCIDs.forEach((cid) => {
      if (!targetCIDs.has(cid)) {
        filesRemoved.push(cid);
      }
    });

    const metadataChanged =
      JSON.stringify(currentDataset.metadata) !== JSON.stringify(targetSnapshot.metadata);

    return {
      filesAdded,
      filesRemoved,
      filesModified: [],
      metadataChanged,
      configChanged: false,
      summary: `Rollback to version with ${targetSnapshot.fileCount} files`,
    };
  }

  /**
   * Compute metadata changes between two metadata objects
   */
  private computeMetadataChanges(
    from: DatasetMetadata,
    to: DatasetMetadata,
  ): Record<string, { from: unknown; to: unknown }> {
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    // Compare all metadata fields
    const allKeys = new Set([...Object.keys(from), ...Object.keys(to)]);

    allKeys.forEach((key) => {
      const fromValue = (from as any)[key];
      const toValue = (to as any)[key];

      if (JSON.stringify(fromValue) !== JSON.stringify(toValue)) {
        changes[key] = { from: fromValue, to: toValue };
      }
    });

    return changes;
  }

  /**
   * Generate human-readable summary of version differences
   */
  private generateDiffSummary(
    added: number,
    removed: number,
    modified: number,
    metadataChanges: number,
  ): string {
    const parts: string[] = [];

    if (added > 0) parts.push(`${added} file(s) added`);
    if (removed > 0) parts.push(`${removed} file(s) removed`);
    if (modified > 0) parts.push(`${modified} file(s) modified`);
    if (metadataChanges > 0) parts.push(`${metadataChanges} metadata field(s) changed`);

    if (parts.length === 0) {
      return "No changes";
    }

    return parts.join(", ");
  }

  /**
   * Get total number of versions across all datasets
   */
  getTotalVersionCount(): number {
    let count = 0;
    this.versions.forEach((versions) => {
      count += versions.length;
    });
    return count;
  }

  /**
   * Get version count for a specific dataset
   */
  getVersionCount(datasetId: string): number {
    const versions = this.versions.get(datasetId);
    return versions ? versions.length : 0;
  }

  /**
   * Clear all versions (for testing)
   */
  clear(): void {
    this.versions.clear();
    this.logger.info("All versions cleared");
  }

  /**
   * Clear versions for a specific dataset
   */
  clearDatasetVersions(datasetId: string): void {
    this.versions.delete(datasetId);
    this.logger.info("Versions cleared for dataset", { datasetId });
  }
}
