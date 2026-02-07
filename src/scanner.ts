import { readFile, stat } from 'fs/promises';
import { glob } from 'fast-glob';
import type { ScanOptions } from './types.js';

/**
 * Default file extensions to scan
 */
const DEFAULT_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

/**
 * Default directories to ignore
 */
const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/.next/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/coverage/**',
  '**/.turbo/**',
  '**/.cache/**',
  '**/.git/**'
];

/**
 * Default Next.js directories to scan
 */
const NEXTJS_DIRECTORIES = [
  'app',
  'src/app',
  'pages',
  'src/pages',
  'components',
  'src/components',
  'lib',
  'src/lib',
  'utils',
  'src/utils',
  'hooks',
  'src/hooks',
  'contexts',
  'src/contexts',
  'services',
  'src/services',
  'api',
  'src/api'
];

/**
 * Config files to always scan
 */
const CONFIG_FILES = [
  'next.config.{js,mjs,cjs,ts}',
  'tailwind.config.*',
  'postcss.config.*',
  'eslint.config.*',
  '.eslintrc.*',
  'prettier.config.*',
  'jest.config.*',
  'vitest.config.*',
  'playwright.config.*',
  'cypress.config.*',
  'babel.config.*',
  'tsconfig.json'
];

/**
 * Special Next.js files
 */
const NEXTJS_FILES = [
  'middleware.{ts,js}',
  'instrumentation.{ts,js}'
];

/**
 * Find all files to scan
 */
export async function findFiles(options: ScanOptions): Promise<string[]> {
  const patterns: string[] = [];
  
  // Add Next.js directories
  for (const dir of NEXTJS_DIRECTORIES) {
    for (const ext of DEFAULT_EXTENSIONS) {
      patterns.push(`${dir}/**/*${ext}`);
    }
  }
  
  // Add config files
  patterns.push(...CONFIG_FILES);
  patterns.push(...NEXTJS_FILES);
  
  // Add user includes
  if (options.include) {
    patterns.push(...options.include);
  }
  
  const ignore = [...DEFAULT_IGNORE];
  if (options.exclude) {
    ignore.push(...options.exclude);
  }
  
  const files = await glob(patterns, {
    cwd: options.cwd,
    ignore,
    absolute: true,
    onlyFiles: true
  });
  
  return files;
}

/**
 * Quick string-based scan to find potential package references
 * Stage A of the two-stage pipeline
 */
export async function fastScan(
  filePath: string,
  packageNames: string[]
): Promise<string[]> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const found = new Set<string>();
    
    for (const pkg of packageNames) {
      // Check for import statements, require calls, or string references
      const patterns = [
        new RegExp(`import\\s+.*?\\s+from\\s+['""]${escapeRegex(pkg)}`, 'm'),
        new RegExp(`import\\s*\\(\\s*['""]${escapeRegex(pkg)}`, 'm'),
        new RegExp(`require\\s*\\(\\s*['""]${escapeRegex(pkg)}`, 'm'),
        new RegExp(`export\\s+.*?\\s+from\\s+['""]${escapeRegex(pkg)}`, 'm'),
        new RegExp(`['""]${escapeRegex(pkg)}['""]`, 'm')
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          found.add(pkg);
          break;
        }
      }
    }
    
    return Array.from(found);
  } catch {
    return [];
  }
}

/**
 * Get file stats including mtime for caching
 */
export async function getFileStats(filePath: string): Promise<{ mtime: number; size: number } | null> {
  try {
    const stats = await stat(filePath);
    return {
      mtime: stats.mtimeMs,
      size: stats.size
    };
  } catch {
    return null;
  }
}

/**
 * Check if a file is a config file
 */
export function isConfigFile(filePath: string): boolean {
  const basename = filePath.split('/').pop() || '';
  
  const configPatterns = [
    /next\.config\./,
    /tailwind\.config\./,
    /postcss\.config\./,
    /eslint\.config\./,
    /\.eslintrc\./,
    /prettier\.config\./,
    /jest\.config\./,
    /vitest\.config\./,
    /playwright\.config\./,
    /cypress\.config\./,
    /babel\.config\./,
    /tsconfig\.json$/,
    /^middleware\.(ts|js)$/,
    /^instrumentation\.(ts|js)$/
  ];
  
  return configPatterns.some(pattern => pattern.test(basename));
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if file has Next.js "use client" directive
 */
export function hasUseClient(content: string): boolean {
  const firstLines = content.split('\n').slice(0, 10);
  return firstLines.some(line => 
    line.trim() === '"use client"' || 
    line.trim() === "'use client'"
  );
}

/**
 * Normalize package name from import path (handle subpaths)
 */
export function normalizePackageName(importPath: string): string {
  // Handle scoped packages
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
  }
  
  // Handle regular packages
  const parts = importPath.split('/');
  return parts[0];
}
