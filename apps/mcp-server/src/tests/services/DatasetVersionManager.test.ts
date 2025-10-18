/**
 * DatasetVersionManager tests
 * Tests for semantic versioning and rollback capabilities
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DatasetVersionManager } from "../../services/DatasetVersionManager.js";
import { Dataset, VersionChanges } from "@lighthouse-tooling/types";

describe("DatasetVersionManager", () => {
  let manager: DatasetVersionManager;
  let mockDataset: Dataset;

  beforeEach(() => {
    manager = new DatasetVersionManager();

    mockDataset = {
      id: "dataset-1",
      name: "Test Dataset",
      description: "Test description",
      files: [
        {
          cid: "QmTest1",
          size: 100,
          encrypted: false,
          uploadedAt: new Date(),
          originalPath: "test1.txt",
        },
      ],
      metadata: {
        author: "Test Author",
        license: "MIT",
      },
      version: "1.0.0",
      createdAt: new Date(),
      updatedAt: new Date(),
      encrypted: false,
    };
  });

  describe("createVersion", () => {
    it("should create initial version", async () => {
      const changes: VersionChanges = {
        filesAdded: ["QmTest1"],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Initial version",
      };

      const version = await manager.createVersion(mockDataset, changes);

      expect(version.id).toBeDefined();
      expect(version.datasetId).toBe(mockDataset.id);
      expect(version.version).toBe("1.0.0");
      expect(version.snapshot.files).toHaveLength(1);
    });

    it("should bump minor version when files added", async () => {
      const changes: VersionChanges = {
        filesAdded: ["QmTest2"],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Added file",
      };

      const version = await manager.createVersion(mockDataset, changes);

      expect(version.version).toBe("1.1.0");
    });

    it("should bump major version when files removed", async () => {
      const changes: VersionChanges = {
        filesAdded: [],
        filesRemoved: ["QmTest1"],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Removed file",
      };

      const version = await manager.createVersion(mockDataset, changes);

      expect(version.version).toBe("2.0.0");
    });

    it("should bump patch version for metadata changes", async () => {
      const changes: VersionChanges = {
        filesAdded: [],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: true,
        configChanged: false,
        summary: "Updated metadata",
      };

      const version = await manager.createVersion(mockDataset, changes);

      expect(version.version).toBe("1.0.1");
    });

    it("should store snapshot correctly", async () => {
      const changes: VersionChanges = {
        filesAdded: [],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Test snapshot",
      };

      const version = await manager.createVersion(mockDataset, changes);

      expect(version.snapshot.files).toHaveLength(1);
      expect(version.snapshot.fileCount).toBe(1);
      expect(version.snapshot.totalSize).toBe(100);
      expect(version.snapshot.metadata).toEqual(mockDataset.metadata);
    });
  });

  describe("listVersions", () => {
    it("should list versions in descending order", async () => {
      const changes1: VersionChanges = {
        filesAdded: ["QmTest1"],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Version 1",
      };

      const changes2: VersionChanges = {
        filesAdded: ["QmTest2"],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Version 2",
      };

      await manager.createVersion(mockDataset, changes1);

      mockDataset.version = "1.0.0";
      await manager.createVersion(mockDataset, changes2);

      const versions = manager.listVersions(mockDataset.id);

      expect(versions.length).toBe(2);
      expect(versions[0].version).toBe("1.1.0");
      expect(versions[1].version).toBe("1.0.0");
    });

    it("should return empty array for dataset with no versions", () => {
      const versions = manager.listVersions("nonexistent-dataset");
      expect(versions).toEqual([]);
    });
  });

  describe("getVersion", () => {
    it("should retrieve specific version", async () => {
      const changes: VersionChanges = {
        filesAdded: ["QmTest1"],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Test version",
      };

      await manager.createVersion(mockDataset, changes);

      const version = manager.getVersion(mockDataset.id, "1.0.0");

      expect(version).toBeDefined();
      expect(version?.version).toBe("1.0.0");
    });

    it("should return undefined for non-existent version", () => {
      const version = manager.getVersion(mockDataset.id, "99.99.99");
      expect(version).toBeUndefined();
    });
  });

  describe("rollbackToVersion", () => {
    it("should rollback dataset to previous version", async () => {
      const changes1: VersionChanges = {
        filesAdded: ["QmTest1"],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Initial version",
      };

      const version1 = await manager.createVersion(mockDataset, changes1);

      // Modify dataset
      mockDataset.files.push({
        cid: "QmTest2",
        size: 200,
        encrypted: false,
        uploadedAt: new Date(),
        originalPath: "test2.txt",
      });
      mockDataset.version = "1.0.0";

      const changes2: VersionChanges = {
        filesAdded: ["QmTest2"],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Added file",
      };

      await manager.createVersion(mockDataset, changes2);

      // Rollback
      const rolledBack = await manager.rollbackToVersion(mockDataset, "1.0.0");

      expect(rolledBack.files).toHaveLength(1);
      expect(rolledBack.files[0].cid).toBe("QmTest1");
    });

    it("should throw error for non-existent version", async () => {
      await expect(manager.rollbackToVersion(mockDataset, "99.99.99")).rejects.toThrow(
        "Version 99.99.99 not found",
      );
    });
  });

  describe("compareVersions", () => {
    it("should compare versions and show differences", async () => {
      const changes1: VersionChanges = {
        filesAdded: ["QmTest1"],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Initial version",
      };

      await manager.createVersion(mockDataset, changes1);

      mockDataset.files.push({
        cid: "QmTest2",
        size: 200,
        encrypted: false,
        uploadedAt: new Date(),
        originalPath: "test2.txt",
      });
      mockDataset.version = "1.0.0";

      const changes2: VersionChanges = {
        filesAdded: ["QmTest2"],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Added file",
      };

      await manager.createVersion(mockDataset, changes2);

      const diff = manager.compareVersions(mockDataset.id, "1.0.0", "1.1.0");

      expect(diff.filesAdded.length).toBe(1);
      expect(diff.filesAdded[0].cid).toBe("QmTest2");
      expect(diff.summary).toContain("1 file(s) added");
    });

    it("should detect removed files", async () => {
      mockDataset.files = [
        {
          cid: "QmTest1",
          size: 100,
          encrypted: false,
          uploadedAt: new Date(),
          originalPath: "test1.txt",
        },
        {
          cid: "QmTest2",
          size: 200,
          encrypted: false,
          uploadedAt: new Date(),
          originalPath: "test2.txt",
        },
      ];

      const changes1: VersionChanges = {
        filesAdded: ["QmTest1", "QmTest2"],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Two files",
      };

      await manager.createVersion(mockDataset, changes1);

      mockDataset.files = [mockDataset.files[0]];
      mockDataset.version = "1.0.0";

      const changes2: VersionChanges = {
        filesAdded: [],
        filesRemoved: ["QmTest2"],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Removed file",
      };

      await manager.createVersion(mockDataset, changes2);

      const diff = manager.compareVersions(mockDataset.id, "1.0.0", "2.0.0");

      expect(diff.filesRemoved.length).toBe(1);
      expect(diff.filesRemoved[0].cid).toBe("QmTest2");
    });

    it("should detect metadata changes", async () => {
      const changes1: VersionChanges = {
        filesAdded: ["QmTest1"],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Initial",
      };

      await manager.createVersion(mockDataset, changes1);

      mockDataset.metadata.author = "New Author";
      mockDataset.version = "1.0.0";

      const changes2: VersionChanges = {
        filesAdded: [],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: true,
        configChanged: false,
        summary: "Metadata changed",
      };

      await manager.createVersion(mockDataset, changes2);

      const diff = manager.compareVersions(mockDataset.id, "1.0.0", "1.0.1");

      expect(Object.keys(diff.metadataChanges).length).toBeGreaterThan(0);
      expect(diff.summary).toContain("metadata");
    });
  });

  describe("utility methods", () => {
    it("should get total version count", async () => {
      const changes: VersionChanges = {
        filesAdded: ["QmTest1"],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Test",
      };

      await manager.createVersion(mockDataset, changes);
      await manager.createVersion(mockDataset, changes);

      const count = manager.getTotalVersionCount();
      expect(count).toBe(2);
    });

    it("should get version count for specific dataset", async () => {
      const changes: VersionChanges = {
        filesAdded: ["QmTest1"],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Test",
      };

      await manager.createVersion(mockDataset, changes);

      const count = manager.getVersionCount(mockDataset.id);
      expect(count).toBe(1);
    });

    it("should clear all versions", async () => {
      const changes: VersionChanges = {
        filesAdded: ["QmTest1"],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Test",
      };

      await manager.createVersion(mockDataset, changes);

      manager.clear();

      const count = manager.getTotalVersionCount();
      expect(count).toBe(0);
    });

    it("should clear versions for specific dataset", async () => {
      const changes: VersionChanges = {
        filesAdded: ["QmTest1"],
        filesRemoved: [],
        filesModified: [],
        metadataChanged: false,
        configChanged: false,
        summary: "Test",
      };

      await manager.createVersion(mockDataset, changes);

      manager.clearDatasetVersions(mockDataset.id);

      const count = manager.getVersionCount(mockDataset.id);
      expect(count).toBe(0);
    });
  });
});
