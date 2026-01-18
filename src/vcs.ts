import { getGitStatus, type GitStatus, type FileStats } from './git.js';
import { getJujutsuStatus, isJujutsuRepo, type JujutsuStatus } from './jujutsu.js';

export type VcsType = 'git' | 'jj';

export interface VcsStatus {
  type: VcsType;
  /** Branch name (git) or change ID (jj) */
  branch: string;
  /** Additional labels: git remote tracking, jj bookmarks */
  labels?: string[];
  isDirty: boolean;
  ahead: number;
  behind: number;
  fileStats?: FileStats;
  /** Jujutsu-specific: has conflicts */
  hasConflicts?: boolean;
}

/**
 * Get VCS status for the working directory.
 * Prefers Jujutsu if .jj directory exists, otherwise falls back to Git.
 */
export async function getVcsStatus(cwd?: string): Promise<VcsStatus | null> {
  if (!cwd) return null;

  // Check for Jujutsu first (it can coexist with git)
  if (isJujutsuRepo(cwd)) {
    const jjStatus = await getJujutsuStatus(cwd);
    if (jjStatus) {
      return convertJujutsuStatus(jjStatus);
    }
  }

  // Fall back to Git
  const gitStatus = await getGitStatus(cwd);
  if (gitStatus) {
    return convertGitStatus(gitStatus);
  }

  return null;
}

function convertGitStatus(git: GitStatus): VcsStatus {
  return {
    type: 'git',
    branch: git.branch,
    isDirty: git.isDirty,
    ahead: git.ahead,
    behind: git.behind,
    fileStats: git.fileStats,
  };
}

function convertJujutsuStatus(jj: JujutsuStatus): VcsStatus {
  // Display bookmark if available, otherwise change ID
  const branch = jj.bookmarks.length > 0 ? jj.bookmarks[0] : jj.changeId;
  const labels = jj.bookmarks.length > 1 ? jj.bookmarks.slice(1) : undefined;

  return {
    type: 'jj',
    branch,
    labels,
    isDirty: jj.isDirty,
    ahead: 0, // Jujutsu doesn't have traditional ahead/behind
    behind: 0,
    fileStats: jj.fileStats,
    hasConflicts: jj.hasConflicts,
  };
}

// Re-export for backward compatibility
export type { FileStats } from './git.js';
