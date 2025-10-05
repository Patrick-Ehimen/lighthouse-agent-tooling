/**
 * MockDatasetService unit tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockDatasetService } from '../../services/MockDatasetService.js';
import { MockLighthouseService } from '../../services/MockLighthouseService.js';
import { createTestFile, cleanupTestFiles } from '../utils/test-helpers.js';

describe('MockDatasetService', () => {
  let service: MockDatasetService;
  let lighthouseService: MockLighthouseService;
  let testFilePath1: string;
  let testFilePath2: string;

  beforeEach(async () => {
    lighthouseService = new MockLighthouseService();
    service = new MockDatasetService(lighthouseService);
    testFilePath1 = await createTestFile('test1.txt', 'First test file');
    testFilePath2 = await createTestFile('test2.txt', 'Second test file');
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    service.clear();
    lighthouseService.clear();
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  describe('createDataset', () => {
    it('should create dataset successfully', async () => {
      const dataset = await service.createDataset({
        name: 'Test Dataset',
        description: 'A test dataset',
        files: [testFilePath1, testFilePath2],
      });

      expect(dataset.id).toBeDefined();
      expect(dataset.name).toBe('Test Dataset');
      expect(dataset.description).toBe('A test dataset');
      expect(dataset.files).toHaveLength(2);
      expect(dataset.version).toBe('1.0.0');
      expect(dataset.createdAt).toBeInstanceOf(Date);
    });

    it('should create encrypted dataset', async () => {
      const dataset = await service.createDataset({
        name: 'Encrypted Dataset',
        files: [testFilePath1],
        encrypt: true,
      });

      expect(dataset.encrypted).toBe(true);
      expect(dataset.files[0].encrypted).toBe(true);
    });

    it('should create dataset with metadata', async () => {
      const metadata = {
        author: 'Test Author',
        license: 'MIT',
        category: 'test',
        keywords: ['test', 'dataset'],
        custom: { key: 'value' },
      };

      const dataset = await service.createDataset({
        name: 'Dataset with Metadata',
        files: [testFilePath1],
        metadata,
      });

      expect(dataset.metadata.author).toBe('Test Author');
      expect(dataset.metadata.license).toBe('MIT');
      expect(dataset.metadata.category).toBe('test');
      expect(dataset.metadata.keywords).toEqual(['test', 'dataset']);
    });

    it('should create dataset with tags', async () => {
      const dataset = await service.createDataset({
        name: 'Tagged Dataset',
        files: [testFilePath1],
        tags: ['tag1', 'tag2'],
      });

      expect(dataset.files[0].tags).toContain('tag1');
      expect(dataset.files[0].tags).toContain('tag2');
    });

    it('should create dataset with access conditions', async () => {
      const accessConditions = [
        { type: 'token_balance' as any, condition: 'balance', value: '100' },
      ];

      const dataset = await service.createDataset({
        name: 'Controlled Dataset',
        files: [testFilePath1],
        accessConditions,
      });

      expect(dataset.accessConditions).toEqual(accessConditions);
    });

    it('should throw error for missing name', async () => {
      await expect(
        service.createDataset({
          name: '',
          files: [testFilePath1],
        })
      ).rejects.toThrow('Dataset name is required');
    });

    it('should throw error for empty files array', async () => {
      await expect(
        service.createDataset({
          name: 'Empty Dataset',
          files: [],
        })
      ).rejects.toThrow('At least one file is required');
    });

    it('should throw error for duplicate dataset name', async () => {
      await service.createDataset({
        name: 'Duplicate Dataset',
        files: [testFilePath1],
      });

      await expect(
        service.createDataset({
          name: 'Duplicate Dataset',
          files: [testFilePath2],
        })
      ).rejects.toThrow('already exists');
    });
  });

  describe('getDataset', () => {
    it('should retrieve dataset by ID', async () => {
      const created = await service.createDataset({
        name: 'Test Dataset',
        files: [testFilePath1],
      });

      const retrieved = service.getDataset(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Dataset');
    });

    it('should return undefined for non-existent ID', () => {
      const dataset = service.getDataset('nonexistent-id');
      expect(dataset).toBeUndefined();
    });
  });

  describe('listDatasets', () => {
    beforeEach(async () => {
      await service.createDataset({
        name: 'Dataset 1',
        files: [testFilePath1],
        encrypt: true,
        tags: ['tag1'],
      });

      await service.createDataset({
        name: 'Dataset 2',
        files: [testFilePath2],
        encrypt: false,
        tags: ['tag2'],
      });
    });

    it('should list all datasets', () => {
      const datasets = service.listDatasets();
      expect(datasets).toHaveLength(2);
    });

    it('should filter by encrypted flag true', () => {
      const encrypted = service.listDatasets({ encrypted: true });
      expect(encrypted).toHaveLength(1);
      expect(encrypted[0].name).toBe('Dataset 1');
    });

    it('should filter by encrypted flag false', () => {
      const unencrypted = service.listDatasets({ encrypted: false });
      expect(unencrypted).toHaveLength(1);
      expect(unencrypted[0].name).toBe('Dataset 2');
    });

    it('should filter by name pattern', () => {
      const filtered = service.listDatasets({ namePattern: 'Dataset 1' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Dataset 1');
    });

    it('should filter by tags', () => {
      const filtered = service.listDatasets({ tags: ['tag1'] });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Dataset 1');
    });

    it('should return empty array when no matches', () => {
      const filtered = service.listDatasets({ namePattern: 'NonExistent' });
      expect(filtered).toHaveLength(0);
    });
  });

  describe('updateDataset', () => {
    it('should update dataset description', async () => {
      const dataset = await service.createDataset({
        name: 'Original Dataset',
        files: [testFilePath1],
      });

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await service.updateDataset(dataset.id, {
        description: 'Updated description',
      });

      expect(updated.description).toBe('Updated description');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(dataset.createdAt.getTime());
    });

    it('should update dataset metadata', async () => {
      const dataset = await service.createDataset({
        name: 'Original Dataset',
        files: [testFilePath1],
      });

      const updated = await service.updateDataset(dataset.id, {
        metadata: { newKey: 'newValue' },
      });

      expect(updated.metadata.custom).toHaveProperty('newKey', 'newValue');
    });

    it('should update dataset version', async () => {
      const dataset = await service.createDataset({
        name: 'Original Dataset',
        files: [testFilePath1],
      });

      const updated = await service.updateDataset(dataset.id, {
        version: '2.0.0',
      });

      expect(updated.version).toBe('2.0.0');
    });

    it('should throw error for non-existent dataset', async () => {
      await expect(
        service.updateDataset('nonexistent-id', { description: 'test' })
      ).rejects.toThrow('Dataset not found');
    });
  });

  describe('addFilesToDataset', () => {
    it('should add files to existing dataset', async () => {
      const dataset = await service.createDataset({
        name: 'Growing Dataset',
        files: [testFilePath1],
      });

      const updated = await service.addFilesToDataset(dataset.id, [testFilePath2]);

      expect(updated.files).toHaveLength(2);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(dataset.createdAt.getTime());
    });

    it('should maintain encryption settings when adding files', async () => {
      const dataset = await service.createDataset({
        name: 'Encrypted Dataset',
        files: [testFilePath1],
        encrypt: true,
      });

      const updated = await service.addFilesToDataset(dataset.id, [testFilePath2]);

      expect(updated.files[1].encrypted).toBe(true);
    });

    it('should throw error for non-existent dataset', async () => {
      await expect(
        service.addFilesToDataset('nonexistent-id', [testFilePath1])
      ).rejects.toThrow('Dataset not found');
    });
  });

  describe('deleteDataset', () => {
    it('should delete dataset successfully', async () => {
      const dataset = await service.createDataset({
        name: 'To Delete',
        files: [testFilePath1],
      });

      const result = service.deleteDataset(dataset.id);
      expect(result).toBe(true);

      const retrieved = service.getDataset(dataset.id);
      expect(retrieved).toBeUndefined();
    });

    it('should return false for non-existent dataset', () => {
      const result = service.deleteDataset('nonexistent-id');
      expect(result).toBe(false);
    });
  });

  describe('getDatasetStats', () => {
    it('should return dataset statistics', async () => {
      const dataset = await service.createDataset({
        name: 'Stats Dataset',
        files: [testFilePath1, testFilePath2],
      });

      const stats = service.getDatasetStats(dataset.id);

      expect(stats).toBeDefined();
      expect(stats?.fileCount).toBe(2);
      expect(stats?.totalSize).toBeGreaterThan(0);
      expect(stats?.createdAt).toBeInstanceOf(Date);
      expect(stats?.updatedAt).toBeInstanceOf(Date);
    });

    it('should return undefined for non-existent dataset', () => {
      const stats = service.getDatasetStats('nonexistent-id');
      expect(stats).toBeUndefined();
    });
  });

  describe('getAllStats', () => {
    it('should return overall statistics', async () => {
      await service.createDataset({
        name: 'Dataset 1',
        files: [testFilePath1],
        encrypt: true,
      });

      await service.createDataset({
        name: 'Dataset 2',
        files: [testFilePath2],
      });

      const stats = service.getAllStats();

      expect(stats.totalDatasets).toBe(2);
      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.encryptedDatasets).toBe(1);
    });

    it('should return zero stats when no datasets', () => {
      const stats = service.getAllStats();

      expect(stats.totalDatasets).toBe(0);
      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.encryptedDatasets).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all datasets', async () => {
      await service.createDataset({
        name: 'Dataset 1',
        files: [testFilePath1],
      });

      await service.createDataset({
        name: 'Dataset 2',
        files: [testFilePath2],
      });

      service.clear();

      const datasets = service.listDatasets();
      expect(datasets).toHaveLength(0);
    });
  });
});

