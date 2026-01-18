import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { FileStats } from './git.js';

const execFileAsync = promisify(execFile);

export interface JujutsuStatus {
  changeId: string;
  bookmarks: string[];
  isDirty: boolean;
  fileStats?: FileStats;
  hasConflicts: boolean;
}

/**
 * Check if the directory is a Jujutsu repository
 */
export function isJujutsuRepo(cwd: string): boolean {
  return existsSync(join(cwd, '.jj'));
}

/**
 * Get Jujutsu status for the working directory
 */
export async function getJujutsuStatus(cwd?: string): Promise<JujutsuStatus | null> {
  if (!cwd) return null;

  try {
    // Get change ID using template
    const { stdout: changeIdOut } = await execFileAsync(
      'jj',
      ['log', '-r', '@', '--no-graph', '-T', 'self.change_id().shortest()'],
      { cwd, timeout: 2000, encoding: 'utf8' }
    );
    const changeId = changeIdOut.trim();
    if (!changeId) return null;

    // Get bookmarks on current change
    let bookmarks: string[] = [];
    try {
      const { stdout: bookmarksOut } = await execFileAsync(
        'jj',
        ['log', '-r', '@', '--no-graph', '-T', 'self.bookmarks().map(|b| b.name()).join(" ")'],
        { cwd, timeout: 1000, encoding: 'utf8' }
      );
      const trimmed = bookmarksOut.trim();
      if (trimmed) {
        bookmarks = trimmed.split(/\s+/).filter(Boolean);
      }
    } catch {
      // Ignore bookmark errors
    }

    // Check for dirty state and conflicts using jj status
    let isDirty = false;
    let hasConflicts = false;
    let fileStats: FileStats | undefined;
    try {
      const { stdout: statusOut } = await execFileAsync(
        'jj',
        ['status'],
        { cwd, timeout: 1000, encoding: 'utf8' }
      );
      const { dirty, conflicts, stats } = parseJujutsuStatus(statusOut);
      isDirty = dirty;
      hasConflicts = conflicts;
      if (dirty) {
        fileStats = stats;
      }
    } catch {
      // Ignore errors, assume clean
    }

    return { changeId, bookmarks, isDirty, fileStats, hasConflicts };
  } catch {
    return null;
  }
}

/**
 * Parse jj status output to extract file stats
 * Example output:
 *   Working copy changes:
 *   M src/file.ts
 *   A new-file.ts
 *   D deleted.ts
 *   ? untracked.ts
 *
 *   Working copy : abc123 (conflict)
 */
function parseJujutsuStatus(output: string): { dirty: boolean; conflicts: boolean; stats: FileStats } {
  const stats: FileStats = { modified: 0, added: 0, deleted: 0, untracked: 0 };
  let dirty = false;
  let conflicts = false;

  const lines = output.split('\n');
  for (const line of lines) {
    // Check for conflicts marker
    if (line.includes('(conflict)')) {
      conflicts = true;
    }

    // Parse file status lines (format: "X path" where X is status code)
    const match = line.match(/^([MAD?])\s+/);
    if (match) {
      dirty = true;
      const status = match[1];
      switch (status) {
        case 'M':
          stats.modified++;
          break;
        case 'A':
          stats.added++;
          break;
        case 'D':
          stats.deleted++;
          break;
        case '?':
          stats.untracked++;
          break;
      }
    }
  }

  return { dirty, conflicts, stats };
}
