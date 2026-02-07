import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';

/**
 * Represents a cached analysis result for a file.
 */
export interface CacheEntry {
  /** Content hash of the file when cached */
  hash: string;
  /** File modification time (ms since epoch) when cached */
  mtime: number;
  /** List of imported package names found in the file */
  imports: string[];
  /** Whether file contains "use client" directive */
  isClient?: boolean;
}

/**
 * Options for configuring the CacheManager.
 */
export interface CacheOptions {
  /** Directory where cache files will be stored */
  cacheDir: string;
  /** Whether caching is enabled */
  enabled: boolean;
}

/** Name of the cache subdirectory */
const CACHE_DIRNAME = '.midna-cache';

/**
 * Manages file-based caching for Midna CLI.
 * 
 * Cache entries are stored as JSON files in a `.midna-cache` subdirectory.
 * Each file's cache key is derived from its path, escaped for filesystem safety.
 * 
 * @example
 * ```typescript
 * const cache = new CacheManager({ cacheDir: '.', enabled: true });
 * const cached = await cache.get('/path/to/file.ts');
 * if (cached) return cached.imports;
 * // ... parse file ...
 * await cache.set('/path/to/file.ts', { hash, mtime, imports, isClient });
 * ```
 */
export class CacheManager {
  private readonly cacheDir: string;
  private readonly enabled: boolean;

  /**
   * Creates a new CacheManager instance.
   * 
   * @param options - Configuration options
   * @param options.cacheDir - Base directory for cache storage
   * @param options.enabled - Whether caching is enabled
   */
  constructor(options: CacheOptions) {
    this.cacheDir = join(options.cacheDir, CACHE_DIRNAME);
    this.enabled = options.enabled;
  }

  /**
   * Retrieves a cached entry for a file if it exists and is still valid.
   * 
   * A cache entry is considered valid if:
   * 1. The cache file exists
   * 2. The file's current mtime matches the cached mtime
   * 
   * @param filePath - Absolute path to the source file
   * @returns The cached entry if valid, null otherwise
   */
  async get(filePath: string): Promise<CacheEntry | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const cacheFilePath = this.getCacheFilePath(filePath);
      const cacheContent = await readFile(cacheFilePath, 'utf-8');
      const cached: CacheEntry = JSON.parse(cacheContent);

      // Validate mtime - if file has changed, cache is stale
      const fileStat = await stat(filePath);
      const currentMtime = fileStat.mtimeMs;

      if (cached.mtime !== currentMtime) {
        return null;
      }

      return cached;
    } catch {
      // Cache miss: file doesn't exist or other read error
      return null;
    }
  }

  /**
   * Stores a cache entry for a file.
   * 
   * Creates the cache directory if it doesn't exist.
   * Does nothing if caching is disabled.
   * 
   * @param filePath - Absolute path to the source file
   * @param entry - Cache entry to store
   */
  async set(filePath: string, entry: CacheEntry): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const cacheFilePath = this.getCacheFilePath(filePath);
      
      // Ensure cache directory exists
      await mkdir(dirname(cacheFilePath), { recursive: true });

      // Write cache entry as JSON
      const content = JSON.stringify(entry, null, 2);
      await writeFile(cacheFilePath, content, 'utf-8');
    } catch {
      // Silently fail on cache write errors - caching is optional
    }
  }

  /**
   * Clears all cached entries by removing the cache directory.
   * 
   * Does nothing if caching is disabled.
   */
  async clear(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await rm(this.cacheDir, { recursive: true, force: true });
    } catch {
      // Silently fail if directory doesn't exist or can't be deleted
    }
  }

  /**
   * Creates a SHA-256 hash of the given content.
   * 
   * Used to detect content changes independent of mtime.
   * 
   * @param content - String content to hash
   * @returns Hex-encoded SHA-256 hash
   */
  createHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Converts a file path to a safe cache file path.
   * 
   * Escapes special characters to ensure filesystem compatibility
   * across different operating systems.
   * 
   * @param filePath - Original file path
   * @returns Path to the cache file
   */
  private getCacheFilePath(filePath: string): string {
    // Create a safe filename by replacing problematic characters
    // Use hash of path for uniqueness + shortened readable portion
    const pathHash = this.createHash(filePath).slice(0, 16);
    const safeName = filePath
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/^\.+/, '')
      .slice(-50); // Keep last 50 chars for readability
    
    return join(this.cacheDir, `${pathHash}_${safeName}.json`);
  }
}
