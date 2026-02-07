/**
 * Core types for Midna - Dependency Usage Auditor
 */

/** Classification status of a dependency */
export type DependencyStatus = 'used' | 'unused' | 'uncertain';

/** Which side of the application uses the dependency */
export type UsageSide = 'client' | 'server' | 'both' | 'unknown';

/** Type of evidence for dependency usage */
export type EvidenceType = 
  | 'static_import' 
  | 'dynamic_import' 
  | 'require' 
  | 'config_reference' 
  | 'string_reference' 
  | 'plugin_reference' 
  | 'type_import' 
  | 'export_from' 
  | 'css_import';

/** Package.json dependency sections */
export type DependencySection = 
  | 'dependencies' 
  | 'devDependencies' 
  | 'optionalDependencies' 
  | 'peerDependencies';

/** Single piece of evidence for dependency usage */
export interface EvidenceEntry {
  /** Absolute path to the file */
  file: string;
  /** Line number where evidence was found (1-indexed) */
  line?: number;
  /** Type of evidence */
  type: EvidenceType;
  /** Code snippet or context (truncated if long) */
  snippet?: string;
}

/** Result for a single package */
export interface PackageResult {
  /** Package name */
  name: string;
  /** Which section of package.json this dependency is in */
  section: DependencySection;
  /** Classification status */
  status: DependencyStatus;
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
  /** Where the dependency is used */
  side: UsageSide;
  /** Array of evidence entries */
  evidence: EvidenceEntry[];
  /** Notes and warnings about this classification */
  notes: string[];
}

/** Options for scanning */
export interface ScanOptions {
  /** Current working directory */
  cwd: string;
  /** Additional include patterns */
  include?: string[];
  /** Exclude patterns */
  exclude?: string[];
  /** Disable config file scanning */
  noConfig?: boolean;
  /** Disable cache */
  noCache?: boolean;
  /** Custom cache directory */
  cacheDir?: string;
  /** Threshold for UNUSED classification (default: 0.30) */
  minConfidenceUnused: number;
  /** Threshold for USED classification (default: 0.70) */
  minConfidenceUsed: number;
  /** Specific workspace to scan */
  workspace?: string;
  /** Scan all workspaces */
  allWorkspaces?: boolean;
  /** Only analyze files changed since git ref */
  since?: string;
  /** Verbose logging */
  verbose?: boolean;
}

/** Overall scan result */
export interface ScanResult {
  /** Tool version */
  version: string;
  /** Scan timestamp (ISO string) */
  timestamp: string;
  /** Repository root path */
  repoRoot: string;
  /** Workspace name if scanning specific workspace */
  workspace?: string;
  /** Array of package results */
  packages: PackageResult[];
  /** Totals summary */
  totals: {
    used: number;
    unused: number;
    uncertain: number;
  };
}

/** Cache entry for a file */
export interface CacheEntry {
  /** Content hash */
  hash: string;
  /** File modification time */
  mtime: number;
  /** List of imported package names */
  imports: string[];
  /** Whether file has "use client" directive */
  isClient?: boolean;
}

/** Parsed import information */
export interface ParsedImport {
  /** Base package name (normalized from subpath) */
  packageName: string;
  /** Type of import */
  type: EvidenceType;
  /** Line number */
  line: number;
  /** Whether this is a type-only import */
  isTypeOnly?: boolean;
}

/** Package.json structure */
export interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  types?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

/** Dependency information extracted from package.json */
export interface DependencyInfo {
  /** Package name */
  name: string;
  /** Version or version range */
  version: string;
  /** Which section this dependency belongs to */
  section: DependencySection;
}

/** CLI output format options */
export type OutputFormat = 'table' | 'json';

/** Workspace information */
export interface WorkspaceInfo {
  /** Workspace name (from package.json) */
  name: string;
  /** Absolute path to workspace */
  path: string;
  /** package.json content */
  packageJson: PackageJson;
}
