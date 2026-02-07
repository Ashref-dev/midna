/**
 * Package.json parsing module for Midna CLI.
 * Provides utilities to find, read, and extract dependency information from package.json files.
 * @module package
 */

import { readFile, access, constants } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { PackageJson, DependencyInfo, DependencySection } from './types.js';

const DEPENDENCY_SECTIONS: readonly DependencySection[] = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

/**
 * Search upward from the given directory for a package.json file.
 * Traverses the directory tree from cwd to the filesystem root.
 * @param cwd - The directory to start searching from
 * @returns Full path to package.json if found, null otherwise
 */
export async function findPackageJson(cwd: string): Promise<string | null> {
  let currentDir = cwd;

  while (true) {
    const packagePath = join(currentDir, 'package.json');

    try {
      await access(packagePath, constants.R_OK);
      return packagePath;
    } catch {
      // File doesn't exist or isn't readable, continue searching
    }

    const parentDir = dirname(currentDir);

    // Reached filesystem root
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

/**
 * Read and parse a package.json file.
 * @param path - Absolute path to the package.json file
 * @returns Parsed package.json object
 * @throws Error if file cannot be read or contains invalid JSON
 */
export async function readPackageJson(path: string): Promise<PackageJson> {
  const content = await readFile(path, 'utf-8').catch((error: NodeJS.ErrnoException) => {
    throw new Error(`Failed to read package.json at ${path}: ${error.message}`);
  });

  try {
    return JSON.parse(content) as PackageJson;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Invalid JSON in package.json at ${path}: ${message}`);
  }
}

/**
 * Extract all dependencies from all sections of a package.json.
 * @param pkg - Parsed package.json object
 * @returns Array of dependency info objects with name, version, and section
 */
export function extractDependencies(pkg: PackageJson): DependencyInfo[] {
  const result: DependencyInfo[] = [];

  for (const section of DEPENDENCY_SECTIONS) {
    const deps = pkg[section];
    if (deps && typeof deps === 'object') {
      for (const [name, version] of Object.entries(deps)) {
        result.push({ name, version, section });
      }
    }
  }

  return result;
}

/**
 * Get a unique list of all dependency names across all sections.
 * @param pkg - Parsed package.json object
 * @returns Array of unique package names
 */
export function getAllDependencyNames(pkg: PackageJson): string[] {
  const names = new Set<string>();

  for (const section of DEPENDENCY_SECTIONS) {
    const deps = pkg[section];
    if (deps && typeof deps === 'object') {
      for (const name of Object.keys(deps)) {
        names.add(name);
      }
    }
  }

  return Array.from(names);
}

// npm package name validation regex
// Based on https://github.com/npm/validate-npm-package-name
const SCOPED_PACKAGE_PATTERN = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const MAX_PACKAGE_NAME_LENGTH = 214;

/**
 * Validate that a string is a valid npm package name.
 * Follows npm naming rules: lowercase, no spaces, can be scoped (@org/pkg).
 * @param name - Package name to validate
 * @returns true if valid, false otherwise
 */
export function isValidPackageName(name: string): boolean {
  if (typeof name !== 'string') {
    return false;
  }

  if (name.length === 0 || name.length > MAX_PACKAGE_NAME_LENGTH) {
    return false;
  }

  // Can't start with a dot or underscore
  if (name.startsWith('.') || name.startsWith('_')) {
    return false;
  }

  // Must match valid package pattern
  return SCOPED_PACKAGE_PATTERN.test(name);
}

/**
 * Get the section a dependency belongs to
 */
export function getDependencySection(
  pkg: PackageJson,
  name: string
): DependencySection | null {
  if (pkg.dependencies?.[name]) return 'dependencies';
  if (pkg.devDependencies?.[name]) return 'devDependencies';
  if (pkg.optionalDependencies?.[name]) return 'optionalDependencies';
  if (pkg.peerDependencies?.[name]) return 'peerDependencies';
  return null;
}

export type { PackageJson, DependencyInfo, DependencySection };
