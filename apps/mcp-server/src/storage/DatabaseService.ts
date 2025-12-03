/**
 * Database Service for Persistent Storage
 * @fileoverview SQLite-based persistent storage for files and datasets
 */

import Database from "better-sqlite3";
import * as path from "node:path";
import * as fs from "node:fs";
import { Logger } from "@lighthouse-tooling/shared";
import type { StoredFile } from "../services/ILighthouseService.js";
import type { Dataset } from "@lighthouse-tooling/types";

export interface DatabaseConfig {
  /** Database file path */
  dbPath?: string;
  /** Whether to enable WAL mode for better concurrency */
  enableWAL?: boolean;
  /** Whether to enable foreign keys */
  enableForeignKeys?: boolean;
}

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "lighthouse-storage.db");
const DEFAULT_CONFIG: DatabaseConfig = {
  enableWAL: true,
  enableForeignKeys: true,
};

/**
 * Database service for persistent storage of files and datasets
 */
export class DatabaseService {
  private db: Database.Database;
  private logger: Logger;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = Logger.getInstance({
      level: "info",
      component: "DatabaseService",
    });

    // Ensure data directory exists
    const dbPath = this.config.dbPath || DEFAULT_DB_PATH;
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize database
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL"); // Better concurrency
    this.db.pragma("foreign_keys = ON"); // Enable foreign key constraints

    // Run migrations
    this.runMigrations();

    this.logger.info("Database service initialized", { dbPath });
  }

  /**
   * Run database migrations
   */
  private runMigrations(): void {
    this.logger.info("Running database migrations...");

    // Create files table
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS files (
        cid TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        size INTEGER NOT NULL DEFAULT 0,
        encrypted INTEGER NOT NULL DEFAULT 0,
        pinned INTEGER NOT NULL DEFAULT 0,
        hash TEXT,
        uploaded_at TEXT NOT NULL,
        tags TEXT, -- JSON array
        access_conditions TEXT, -- JSON array
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
      )
      .run();

    // Create datasets table
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        version TEXT NOT NULL DEFAULT '1.0.0',
        encrypted INTEGER NOT NULL DEFAULT 0,
        metadata TEXT, -- JSON object
        access_conditions TEXT, -- JSON array
        tags TEXT, -- JSON array
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
      )
      .run();

    // Create dataset_files junction table
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS dataset_files (
        dataset_id TEXT NOT NULL,
        file_cid TEXT NOT NULL,
        file_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (dataset_id, file_cid),
        FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE,
        FOREIGN KEY (file_cid) REFERENCES files(cid) ON DELETE CASCADE
      )
    `,
      )
      .run();

    // Create indexes for better query performance
    this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON files(uploaded_at)`).run();
    this.db
      .prepare(`CREATE INDEX IF NOT EXISTS idx_datasets_created_at ON datasets(created_at)`)
      .run();
    this.db
      .prepare(`CREATE INDEX IF NOT EXISTS idx_datasets_updated_at ON datasets(updated_at)`)
      .run();
    this.db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_dataset_files_dataset_id ON dataset_files(dataset_id)`,
      )
      .run();
    this.db
      .prepare(`CREATE INDEX IF NOT EXISTS idx_dataset_files_file_cid ON dataset_files(file_cid)`)
      .run();

    this.logger.info("Database migrations completed");
  }

  /**
   * Save or update a file record
   */
  saveFile(file: StoredFile): void {
    const stmt = this.db.prepare(`
      INSERT INTO files (
        cid, file_path, size, encrypted, pinned, hash, uploaded_at, tags, access_conditions, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(cid) DO UPDATE SET
        file_path = excluded.file_path,
        size = excluded.size,
        encrypted = excluded.encrypted,
        pinned = excluded.pinned,
        hash = excluded.hash,
        tags = excluded.tags,
        access_conditions = excluded.access_conditions,
        updated_at = datetime('now')
    `);

    stmt.run(
      file.cid,
      file.filePath,
      file.size,
      file.encrypted ? 1 : 0,
      file.pinned ? 1 : 0,
      file.hash || null,
      file.uploadedAt.toISOString(),
      file.tags ? JSON.stringify(file.tags) : null,
      file.accessConditions ? JSON.stringify(file.accessConditions) : null,
    );
  }

  /**
   * Get a file by CID
   */
  getFile(cid: string): StoredFile | undefined {
    const stmt = this.db.prepare(`SELECT * FROM files WHERE cid = ?`);
    const row = stmt.get(cid) as
      | {
          cid: string;
          file_path: string;
          size: number;
          encrypted: number;
          pinned: number;
          hash: string | null;
          uploaded_at: string;
          tags: string | null;
          access_conditions: string | null;
        }
      | undefined;

    if (!row) {
      return undefined;
    }

    return {
      cid: row.cid,
      filePath: row.file_path,
      size: row.size,
      encrypted: row.encrypted === 1,
      pinned: row.pinned === 1,
      hash: row.hash || undefined,
      uploadedAt: new Date(row.uploaded_at),
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      accessConditions: row.access_conditions ? JSON.parse(row.access_conditions) : undefined,
    };
  }

  /**
   * List all files with optional pagination
   */
  listFiles(limit?: number, offset?: number): StoredFile[] {
    const limitClause = limit ? `LIMIT ${limit}` : "";
    const offsetClause = offset ? `OFFSET ${offset}` : "";
    const stmt = this.db.prepare(
      `SELECT * FROM files ORDER BY uploaded_at DESC ${limitClause} ${offsetClause}`,
    );

    const rows = stmt.all() as Array<{
      cid: string;
      file_path: string;
      size: number;
      encrypted: number;
      pinned: number;
      hash: string | null;
      uploaded_at: string;
      tags: string | null;
      access_conditions: string | null;
    }>;

    return rows.map((row) => ({
      cid: row.cid,
      filePath: row.file_path,
      size: row.size,
      encrypted: row.encrypted === 1,
      pinned: row.pinned === 1,
      hash: row.hash || undefined,
      uploadedAt: new Date(row.uploaded_at),
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      accessConditions: row.access_conditions ? JSON.parse(row.access_conditions) : undefined,
    }));
  }

  /**
   * Get total file count
   */
  getFileCount(): number {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM files`);
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Get total storage size
   */
  getTotalSize(): number {
    const stmt = this.db.prepare(`SELECT SUM(size) as total FROM files`);
    const result = stmt.get() as { total: number | null };
    return result.total || 0;
  }

  /**
   * Delete a file record
   */
  deleteFile(cid: string): void {
    const stmt = this.db.prepare(`DELETE FROM files WHERE cid = ?`);
    stmt.run(cid);
  }

  /**
   * Save or update a dataset
   */
  saveDataset(dataset: Dataset): void {
    const datasetStmt = this.db.prepare(`
      INSERT INTO datasets (
        id, name, description, version, encrypted, metadata, access_conditions, tags, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        version = excluded.version,
        encrypted = excluded.encrypted,
        metadata = excluded.metadata,
        access_conditions = excluded.access_conditions,
        tags = excluded.tags,
        updated_at = datetime('now')
    `);

    datasetStmt.run(
      dataset.id,
      dataset.name,
      dataset.description,
      dataset.version,
      dataset.encrypted ? 1 : 0,
      JSON.stringify(dataset.metadata),
      dataset.accessConditions ? JSON.stringify(dataset.accessConditions) : null,
      dataset.metadata.keywords ? JSON.stringify(dataset.metadata.keywords) : null,
    );

    // Update dataset files
    const deleteFilesStmt = this.db.prepare(`DELETE FROM dataset_files WHERE dataset_id = ?`);
    deleteFilesStmt.run(dataset.id);

    const insertFileStmt = this.db.prepare(`
      INSERT INTO dataset_files (dataset_id, file_cid, file_order)
      VALUES (?, ?, ?)
    `);

    dataset.files.forEach((file, index) => {
      insertFileStmt.run(dataset.id, file.cid, index);
    });
  }

  /**
   * Get a dataset by ID
   */
  getDataset(datasetId: string): Dataset | undefined {
    const datasetStmt = this.db.prepare(`SELECT * FROM datasets WHERE id = ?`);
    const datasetRow = datasetStmt.get(datasetId) as
      | {
          id: string;
          name: string;
          description: string;
          version: string;
          encrypted: number;
          metadata: string;
          access_conditions: string | null;
          tags: string | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!datasetRow) {
      return undefined;
    }

    // Get associated files
    const filesStmt = this.db.prepare(`
      SELECT f.* FROM files f
      INNER JOIN dataset_files df ON f.cid = df.file_cid
      WHERE df.dataset_id = ?
      ORDER BY df.file_order
    `);
    const fileRows = filesStmt.all(datasetId) as Array<{
      cid: string;
      file_path: string;
      size: number;
      encrypted: number;
      pinned: number;
      hash: string | null;
      uploaded_at: string;
      tags: string | null;
      access_conditions: string | null;
    }>;

    const files = fileRows.map((row) => ({
      cid: row.cid,
      size: row.size,
      encrypted: row.encrypted === 1,
      uploadedAt: new Date(row.uploaded_at),
      originalPath: row.file_path,
      hash: row.hash || undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      accessConditions: row.access_conditions ? JSON.parse(row.access_conditions) : undefined,
    }));

    return {
      id: datasetRow.id,
      name: datasetRow.name,
      description: datasetRow.description,
      version: datasetRow.version,
      encrypted: datasetRow.encrypted === 1,
      files,
      metadata: JSON.parse(datasetRow.metadata),
      accessConditions: datasetRow.access_conditions
        ? JSON.parse(datasetRow.access_conditions)
        : undefined,
      createdAt: new Date(datasetRow.created_at),
      updatedAt: new Date(datasetRow.updated_at),
    };
  }

  /**
   * List datasets with pagination
   */
  listDatasets(
    limit?: number,
    offset?: number,
  ): {
    datasets: Dataset[];
    total: number;
  } {
    // Get total count
    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM datasets`);
    const countResult = countStmt.get() as { count: number };
    const total = countResult.count;

    // Get datasets
    const limitClause = limit ? `LIMIT ${limit}` : "";
    const offsetClause = offset ? `OFFSET ${offset}` : "";
    const stmt = this.db.prepare(
      `SELECT * FROM datasets ORDER BY updated_at DESC ${limitClause} ${offsetClause}`,
    );

    const datasetRows = stmt.all() as Array<{
      id: string;
      name: string;
      description: string;
      version: string;
      encrypted: number;
      metadata: string;
      access_conditions: string | null;
      tags: string | null;
      created_at: string;
      updated_at: string;
    }>;

    const datasets: Dataset[] = [];

    for (const datasetRow of datasetRows) {
      // Get files for each dataset
      const filesStmt = this.db.prepare(`
        SELECT f.* FROM files f
        INNER JOIN dataset_files df ON f.cid = df.file_cid
        WHERE df.dataset_id = ?
        ORDER BY df.file_order
      `);
      const fileRows = filesStmt.all(datasetRow.id) as Array<{
        cid: string;
        file_path: string;
        size: number;
        encrypted: number;
        pinned: number;
        hash: string | null;
        uploaded_at: string;
        tags: string | null;
        access_conditions: string | null;
      }>;

      const files = fileRows.map((row) => ({
        cid: row.cid,
        size: row.size,
        encrypted: row.encrypted === 1,
        uploadedAt: new Date(row.uploaded_at),
        originalPath: row.file_path,
        hash: row.hash || undefined,
        tags: row.tags ? JSON.parse(row.tags) : undefined,
        accessConditions: row.access_conditions ? JSON.parse(row.access_conditions) : undefined,
      }));

      datasets.push({
        id: datasetRow.id,
        name: datasetRow.name,
        description: datasetRow.description,
        version: datasetRow.version,
        encrypted: datasetRow.encrypted === 1,
        files,
        metadata: JSON.parse(datasetRow.metadata),
        accessConditions: datasetRow.access_conditions
          ? JSON.parse(datasetRow.access_conditions)
          : undefined,
        createdAt: new Date(datasetRow.created_at),
        updatedAt: new Date(datasetRow.updated_at),
      });
    }

    return { datasets, total };
  }

  /**
   * Delete a dataset
   */
  deleteDataset(datasetId: string, deleteFiles: boolean = false): void {
    if (deleteFiles) {
      // Get file CIDs from dataset
      const filesStmt = this.db.prepare(`
        SELECT file_cid FROM dataset_files WHERE dataset_id = ?
      `);
      const fileRows = filesStmt.all(datasetId) as Array<{ file_cid: string }>;

      // Delete files (cascade will handle dataset_files)
      const deleteFileStmt = this.db.prepare(`DELETE FROM files WHERE cid = ?`);
      for (const row of fileRows) {
        deleteFileStmt.run(row.file_cid);
      }
    }

    // Delete dataset (cascade will handle dataset_files)
    const deleteDatasetStmt = this.db.prepare(`DELETE FROM datasets WHERE id = ?`);
    deleteDatasetStmt.run(datasetId);
  }

  /**
   * Update file pinned status
   */
  updateFilePinned(cid: string, pinned: boolean): void {
    const stmt = this.db.prepare(
      `UPDATE files SET pinned = ?, updated_at = datetime('now') WHERE cid = ?`,
    );
    stmt.run(pinned ? 1 : 0, cid);
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    this.logger.info("Database connection closed");
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.db.prepare(`DELETE FROM dataset_files`).run();
    this.db.prepare(`DELETE FROM datasets`).run();
    this.db.prepare(`DELETE FROM files`).run();
    this.logger.info("Database cleared");
  }
}
