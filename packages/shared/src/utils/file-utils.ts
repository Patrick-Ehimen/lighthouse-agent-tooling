/**
 * File system utilities for path handling and file operations
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { Validator } from "./validator";
import { ErrorFactory } from "./error-handler";
import { FILE_SIZE_LIMITS } from "../constants";

export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  mimeType?: string;
  hash?: string;
  lastModified: Date;
}

export interface DirectoryInfo {
  path: string;
  files: FileInfo[];
  totalSize: number;
  fileCount: number;
}

export class FileUtils {
  /**
   * Get file information including size, hash, and metadata
   */
  static async getFileInfo(filePath: string): Promise<FileInfo> {
    const validation = Validator.validateFilePath(filePath);
    if (!validation.isValid) {
      throw ErrorFactory.validation("filePath", filePath, {
        error: validation.error,
      });
    }

    try {
      const stats = await fs.stat(filePath);

      if (!stats.isFile()) {
        throw ErrorFactory.fileNotFound(filePath, {
          reason: "Path is not a file",
        });
      }

      const name = path.basename(filePath);
      const extension = path.extname(name);
      const hash = await this.calculateFileHash(filePath);

      return {
        path: filePath,
        name,
        extension,
        size: stats.size,
        hash,
        lastModified: stats.mtime,
      };
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw ErrorFactory.fileNotFound(filePath);
      }
      throw error;
    }
  }

  /**
   * Calculate SHA-256 hash of a file
   */
  static async calculateFileHash(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash("sha256").update(fileBuffer).digest("hex");
    } catch (error) {
      throw ErrorFactory.system(`Failed to calculate hash for file: ${filePath}`, { error });
    }
  }

  /**
   * Check if file exists and is accessible
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw ErrorFactory.system(`Failed to create directory: ${dirPath}`, {
        error,
      });
    }
  }

  /**
   * Get directory information including all files and total size
   */
  static async getDirectoryInfo(dirPath: string): Promise<DirectoryInfo> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files: FileInfo[] = [];
      let totalSize = 0;

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(dirPath, entry.name);
          const fileInfo = await this.getFileInfo(filePath);
          files.push(fileInfo);
          totalSize += fileInfo.size;
        }
      }

      return {
        path: dirPath,
        files,
        totalSize,
        fileCount: files.length,
      };
    } catch (error) {
      throw ErrorFactory.system(`Failed to read directory: ${dirPath}`, {
        error,
      });
    }
  }

  /**
   * Validate file size against limits
   */
  static validateFileSize(filePath: string, size?: number): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        const fileSize = size ?? (await this.getFileInfo(filePath)).size;

        if (fileSize > FILE_SIZE_LIMITS.MAX_FILE_SIZE) {
          reject(
            ErrorFactory.validation("fileSize", fileSize, {
              limit: FILE_SIZE_LIMITS.MAX_FILE_SIZE,
              message: "File exceeds maximum size limit",
            }),
          );
          return;
        }

        resolve(true);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Create a temporary file with given content
   */
  static async createTempFile(content: string | Buffer, extension = ".tmp"): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(process.cwd(), "temp-"));
    const tempFile = path.join(tempDir, `file-${Date.now()}${extension}`);

    try {
      await fs.writeFile(tempFile, content);
      return tempFile;
    } catch (error) {
      throw ErrorFactory.system("Failed to create temporary file", { error });
    }
  }

  /**
   * Clean up temporary files and directories
   */
  static async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);

      // Try to remove the parent directory if it's empty
      const parentDir = path.dirname(filePath);
      try {
        await fs.rmdir(parentDir);
      } catch {
        // Ignore errors when removing directory (might not be empty)
      }
    } catch (error) {
      // Log but don't throw - cleanup failures shouldn't break the main flow
      console.warn(`Failed to cleanup temp file: ${filePath}`, error);
    }
  }

  /**
   * Copy file from source to destination
   */
  static async copyFile(source: string, destination: string): Promise<void> {
    const sourceValidation = Validator.validateFilePath(source);
    const destValidation = Validator.validateFilePath(destination);

    if (!sourceValidation.isValid) {
      throw ErrorFactory.validation("source", source, {
        error: sourceValidation.error,
      });
    }

    if (!destValidation.isValid) {
      throw ErrorFactory.validation("destination", destination, {
        error: destValidation.error,
      });
    }

    try {
      // Ensure destination directory exists
      await this.ensureDirectory(path.dirname(destination));

      // Copy the file
      await fs.copyFile(source, destination);
    } catch (error) {
      throw ErrorFactory.system(`Failed to copy file from ${source} to ${destination}`, { error });
    }
  }

  /**
   * Read file content as string with encoding
   */
  static async readFileAsString(
    filePath: string,
    encoding: BufferEncoding = "utf8",
  ): Promise<string> {
    const validation = Validator.validateFilePath(filePath);
    if (!validation.isValid) {
      throw ErrorFactory.validation("filePath", filePath, {
        error: validation.error,
      });
    }

    try {
      return await fs.readFile(filePath, encoding);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw ErrorFactory.fileNotFound(filePath);
      }
      throw ErrorFactory.system(`Failed to read file: ${filePath}`, { error });
    }
  }

  /**
   * Write content to file with proper error handling
   */
  static async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    const validation = Validator.validateFilePath(filePath);
    if (!validation.isValid) {
      throw ErrorFactory.validation("filePath", filePath, {
        error: validation.error,
      });
    }

    try {
      // Ensure directory exists
      await this.ensureDirectory(path.dirname(filePath));

      // Write the file
      await fs.writeFile(filePath, content);
    } catch (error) {
      throw ErrorFactory.system(`Failed to write file: ${filePath}`, { error });
    }
  }

  /**
   * Get relative path from base directory
   */
  static getRelativePath(filePath: string, basePath: string): string {
    return path.relative(basePath, filePath);
  }

  /**
   * Normalize path separators for cross-platform compatibility
   */
  static normalizePath(filePath: string): string {
    return path.normalize(filePath).replace(/\\/g, "/");
  }

  /**
   * Check if path is within allowed directory (prevent path traversal)
   */
  static isPathSafe(filePath: string, allowedBasePath: string): boolean {
    const normalizedPath = path.resolve(filePath);
    const normalizedBase = path.resolve(allowedBasePath);

    return normalizedPath.startsWith(normalizedBase);
  }
}
