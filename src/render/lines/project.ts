import type { RenderContext } from '../../types.js';
import { cyan, magenta, yellow } from '../colors.js';

export function renderProjectLine(ctx: RenderContext): string | null {
  if (!ctx.stdin.cwd) {
    return null;
  }

  const segments = ctx.stdin.cwd.split(/[/\\]/).filter(Boolean);
  const pathLevels = ctx.config?.pathLevels ?? 1;
  const projectPath = segments.length > 0 ? segments.slice(-pathLevels).join('/') : '/';

  let vcsPart = '';
  const gitConfig = ctx.config?.gitStatus;
  const showVcs = gitConfig?.enabled ?? true;

  if (showVcs && ctx.vcsStatus) {
    const vcsParts: string[] = [ctx.vcsStatus.branch];

    // Show conflict indicator for jj
    if (ctx.vcsStatus.hasConflicts) {
      vcsParts.push('⚠');
    }

    if ((gitConfig?.showDirty ?? true) && ctx.vcsStatus.isDirty) {
      vcsParts.push('*');
    }

    if (gitConfig?.showAheadBehind && ctx.vcsStatus.type === 'git') {
      if (ctx.vcsStatus.ahead > 0) {
        vcsParts.push(` ↑${ctx.vcsStatus.ahead}`);
      }
      if (ctx.vcsStatus.behind > 0) {
        vcsParts.push(` ↓${ctx.vcsStatus.behind}`);
      }
    }

    if (gitConfig?.showFileStats && ctx.vcsStatus.fileStats) {
      const { modified, added, deleted, untracked } = ctx.vcsStatus.fileStats;
      const statParts: string[] = [];
      if (modified > 0) statParts.push(`!${modified}`);
      if (added > 0) statParts.push(`+${added}`);
      if (deleted > 0) statParts.push(`✘${deleted}`);
      if (untracked > 0) statParts.push(`?${untracked}`);
      if (statParts.length > 0) {
        vcsParts.push(` ${statParts.join(' ')}`);
      }
    }

    const vcsLabel = ctx.vcsStatus.type === 'jj' ? 'jj' : 'git';
    vcsPart = ` ${magenta(`${vcsLabel}:(`)}${cyan(vcsParts.join(''))}${magenta(')')}`;
  }

  return `${yellow(projectPath)}${vcsPart}`;
}
