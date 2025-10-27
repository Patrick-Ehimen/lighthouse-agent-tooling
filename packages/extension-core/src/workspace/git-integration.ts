/**
 * Git integration implementation
 * @fileoverview Provides Git information for workspace context
 */

import type { GitInfo, CommitInfo } from "@lighthouse-tooling/types";
import { Logger } from "@lighthouse-tooling/shared";
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs/promises";

/**
 * Git integration implementation
 */
export class GitIntegrationImpl {
  private _workspacePath: string;
  private _logger: Logger;
  private _isGitRepo = false;

  constructor(workspacePath: string) {
    this._workspacePath = workspacePath;
    this._logger = new Logger({ level: "info", component: "GitIntegration" });
  }

  /**
   * Initialize Git integration
   */
  async initialize(): Promise<void> {
    try {
      this._isGitRepo = await this._checkIfGitRepo();
      if (this._isGitRepo) {
        this._logger.info("Git repository detected");
      } else {
        this._logger.debug("No Git repository found");
      }
    } catch (error) {
      this._logger.error("Failed to initialize Git integration:", error as Error);
    }
  }

  /**
   * Dispose of Git integration
   */
  async dispose(): Promise<void> {
    // Nothing to dispose for Git integration
  }

  /**
   * Get Git information
   */
  async getGitInfo(): Promise<GitInfo | undefined> {
    if (!this._isGitRepo) {
      return undefined;
    }

    try {
      const [
        branch,
        commit,
        commitMessage,
        author,
        commitDate,
        remoteUrl,
        isClean,
        modifiedFiles,
        stagedFiles,
        untrackedFiles,
        tags,
        recentCommits,
      ] = await Promise.all([
        this._getCurrentBranch(),
        this._getCurrentCommit(),
        this._getCommitMessage(),
        this._getCommitAuthor(),
        this._getCommitDate(),
        this._getRemoteUrl(),
        this._isWorkingDirectoryClean(),
        this._getModifiedFiles(),
        this._getStagedFiles(),
        this._getUntrackedFiles(),
        this._getTags(),
        this._getRecentCommits(),
      ]);

      return {
        branch,
        commit,
        commitMessage,
        author,
        commitDate,
        remoteUrl,
        isClean,
        modifiedFiles,
        stagedFiles,
        untrackedFiles,
        tags,
        recentCommits,
      };
    } catch (error) {
      this._logger.error("Failed to get Git information:", error as Error);
      return undefined;
    }
  }
  /**
   * Check if directory is a Git repository
   */
  private async _checkIfGitRepo(): Promise<boolean> {
    try {
      const gitDir = path.join(this._workspacePath, ".git");
      const stats = await fs.stat(gitDir);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Execute Git command
   */
  private _execGit(command: string): string {
    try {
      return execSync(`git ${command}`, {
        cwd: this._workspacePath,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch (error) {
      this._logger.debug(`Git command failed: git ${command}`, error as Error);
      throw error;
    }
  }

  /**
   * Get current branch
   */
  private async _getCurrentBranch(): Promise<string> {
    try {
      return this._execGit("rev-parse --abbrev-ref HEAD");
    } catch {
      return "unknown";
    }
  }

  /**
   * Get current commit hash
   */
  private async _getCurrentCommit(): Promise<string> {
    try {
      return this._execGit("rev-parse HEAD");
    } catch {
      return "";
    }
  }

  /**
   * Get commit message
   */
  private async _getCommitMessage(): Promise<string | undefined> {
    try {
      return this._execGit('log -1 --pretty=format:"%s"').replace(/"/g, "");
    } catch {
      return undefined;
    }
  }

  /**
   * Get commit author
   */
  private async _getCommitAuthor(): Promise<string | undefined> {
    try {
      return this._execGit('log -1 --pretty=format:"%an"').replace(/"/g, "");
    } catch {
      return undefined;
    }
  }

  /**
   * Get commit date
   */
  private async _getCommitDate(): Promise<Date | undefined> {
    try {
      const dateStr = this._execGit('log -1 --pretty=format:"%ci"').replace(/"/g, "");
      return new Date(dateStr);
    } catch {
      return undefined;
    }
  }

  /**
   * Get remote URL
   */
  private async _getRemoteUrl(): Promise<string | undefined> {
    try {
      return this._execGit("config --get remote.origin.url");
    } catch {
      return undefined;
    }
  }

  /**
   * Check if working directory is clean
   */
  private async _isWorkingDirectoryClean(): Promise<boolean> {
    try {
      const status = this._execGit("status --porcelain");
      return status.length === 0;
    } catch {
      return false;
    }
  }

  /**
   * Get modified files
   */
  private async _getModifiedFiles(): Promise<string[]> {
    try {
      const output = this._execGit("diff --name-only");
      return output ? output.split("\n").filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get staged files
   */
  private async _getStagedFiles(): Promise<string[]> {
    try {
      const output = this._execGit("diff --cached --name-only");
      return output ? output.split("\n").filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get untracked files
   */
  private async _getUntrackedFiles(): Promise<string[]> {
    try {
      const output = this._execGit("ls-files --others --exclude-standard");
      return output ? output.split("\n").filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get Git tags
   */
  private async _getTags(): Promise<string[]> {
    try {
      const output = this._execGit("tag --sort=-version:refname");
      return output ? output.split("\n").filter(Boolean).slice(0, 10) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get recent commits
   */
  private async _getRecentCommits(): Promise<CommitInfo[]> {
    try {
      const output = this._execGit('log -10 --pretty=format:"%H|%s|%an|%ae|%ci|"');
      const lines = output.split("\n").filter(Boolean);

      const commits: CommitInfo[] = [];
      for (const line of lines) {
        const [hash, message, author, email, dateStr] = line.split("|");
        if (hash && message && author && email && dateStr) {
          commits.push({
            hash,
            message,
            author,
            email,
            date: new Date(dateStr),
            filesChanged: await this._getFilesChangedInCommit(hash),
          });
        }
      }

      return commits;
    } catch {
      return [];
    }
  }

  /**
   * Get files changed in a specific commit
   */
  private async _getFilesChangedInCommit(commitHash: string): Promise<string[]> {
    try {
      const output = this._execGit(`diff-tree --no-commit-id --name-only -r ${commitHash}`);
      return output ? output.split("\n").filter(Boolean) : [];
    } catch {
      return [];
    }
  }
}
