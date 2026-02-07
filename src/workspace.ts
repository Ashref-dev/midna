import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { readPackageJson } from './package.js';
import type { WorkspaceInfo } from './types.js';

/**
 * Detect if project uses workspaces
 */
export async function detectWorkspaces(cwd: string): Promise<{ type: 'npm' | 'pnpm' | 'yarn' | null; patterns: string[] }> {
  // Check for pnpm-workspace.yaml
  try {
    const pnpmWorkspacePath = join(cwd, 'pnpm-workspace.yaml');
    await access(pnpmWorkspacePath);
    const content = await readFile(pnpmWorkspacePath, 'utf-8');
    const patterns = parsePnpmWorkspace(content);
    return { type: 'pnpm', patterns };
  } catch {
    // Not pnpm
  }
  
  // Check package.json for workspaces
  try {
    const pkg = await readPackageJson(join(cwd, 'package.json'));
    if (pkg.workspaces) {
      const patterns = Array.isArray(pkg.workspaces) 
        ? pkg.workspaces 
        : pkg.workspaces.packages || [];
      return { type: 'npm', patterns };
    }
  } catch {
    // No workspaces in package.json
  }
  
  return { type: null, patterns: [] };
}

/**
 * Parse pnpm-workspace.yaml content
 */
function parsePnpmWorkspace(content: string): string[] {
  const patterns: string[] = [];
  const lines = content.split('\n');
  let inPackages = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed === 'packages:') {
      inPackages = true;
      continue;
    }
    
    if (inPackages) {
      if (trimmed.startsWith('- ')) {
        const pattern = trimmed.slice(2).replace(/['"]/g, '');
        patterns.push(pattern);
      } else if (trimmed && !trimmed.startsWith('#')) {
        inPackages = false;
      }
    }
  }
  
  return patterns;
}

/**
 * Get all workspace packages
 */
export async function getWorkspaces(cwd: string): Promise<WorkspaceInfo[]> {
  const { patterns } = await detectWorkspaces(cwd);
  
  if (patterns.length === 0) {
    // Single package repo
    try {
      const pkg = await readPackageJson(join(cwd, 'package.json'));
      return [{
        name: pkg.name || 'root',
        path: cwd,
        packageJson: pkg
      }];
    } catch {
      return [];
    }
  }
  
  // Monorepo - would need to glob patterns and find package.json files
  // For now, return root only
  try {
    const pkg = await readPackageJson(join(cwd, 'package.json'));
    return [{
      name: pkg.name || 'root',
      path: cwd,
      packageJson: pkg
    }];
  } catch {
    return [];
  }
}

/**
 * Get specific workspace by name or path
 */
export async function getWorkspace(
  cwd: string,
  nameOrPath: string
): Promise<WorkspaceInfo | null> {
  const workspaces = await getWorkspaces(cwd);
  
  // Try to find by name
  const byName = workspaces.find(w => w.name === nameOrPath);
  if (byName) return byName;
  
  // Try to find by path
  const byPath = workspaces.find(w => w.path === nameOrPath || w.path.endsWith(nameOrPath));
  if (byPath) return byPath;
  
  return null;
}
