import { readFile } from 'fs/promises';
import { join } from 'path';
import { findFiles, fastScan, getFileStats } from './scanner.js';
import { parseFile, detectUseClient } from './parser.js';
import { readPackageJson, getAllDependencyNames, getDependencySection } from './package.js';
import { CacheManager } from './cache.js';
import { calculateConfidence, classifyDependency, determineUsageSide, generateNotes } from './confidence.js';
import type { ScanOptions, ScanResult, PackageResult, EvidenceEntry } from './types.js';

const VERSION = '1.0.0';

/**
 * Run the full dependency scan
 */
export async function runScan(options: ScanOptions): Promise<ScanResult> {
  const cache = new CacheManager({
    cacheDir: options.cacheDir || options.cwd,
    enabled: !options.noCache
  });
  
  // Read package.json
  const packagePath = join(options.cwd, 'package.json');
  const packageJson = await readPackageJson(packagePath);
  const allDeps = getAllDependencyNames(packageJson);
  
  if (options.verbose) {
    console.error(`Found ${allDeps.length} dependencies to analyze`);
  }
  
  // Find all files to scan
  const files = await findFiles(options);
  
  if (options.verbose) {
    console.error(`Scanning ${files.length} files`);
  }
  
  // Track evidence for each package
  const evidenceMap = new Map<string, EvidenceEntry[]>();
  const sideMap = new Map<string, Map<string, boolean>>();
  
  // Process each file
  for (const filePath of files) {
    await processFile(filePath, allDeps, evidenceMap, sideMap, cache);
  }
  
  // Build results
  const packages: PackageResult[] = [];
  
  for (const depName of allDeps) {
    const evidence = evidenceMap.get(depName) || [];
    const sideResults = sideMap.get(depName) || new Map<string, boolean>();
    
    const confidence = calculateConfidence(evidence);
    const status = classifyDependency(
      confidence,
      options.minConfidenceUnused,
      options.minConfidenceUsed
    );
    const section = getDependencySection(packageJson, depName) || 'dependencies';
    
    const result: PackageResult = {
      name: depName,
      section,
      status,
      confidence,
      side: determineUsageSide(sideResults),
      evidence,
      notes: generateNotes(status, evidence, section)
    };
    
    packages.push(result);
  }
  
  // Calculate totals
  const totals = {
    used: packages.filter(p => p.status === 'used').length,
    unused: packages.filter(p => p.status === 'unused').length,
    uncertain: packages.filter(p => p.status === 'uncertain').length
  };
  
  return {
    version: VERSION,
    timestamp: new Date().toISOString(),
    repoRoot: options.cwd,
    workspace: options.workspace,
    packages,
    totals
  };
}

/**
 * Process a single file
 */
async function processFile(
  filePath: string,
  packageNames: string[],
  evidenceMap: Map<string, EvidenceEntry[]>,
  sideMap: Map<string, Map<string, boolean>>,
  cache: CacheManager
): Promise<void> {
  // Try cache first
  const cached = await cache.get(filePath);
  const stats = await getFileStats(filePath);
  
  if (cached && stats && cached.mtime === stats.mtime) {
    // Use cached results
    for (const pkg of cached.imports) {
      addEvidence(evidenceMap, pkg, {
        file: filePath,
        type: 'static_import',
        snippet: '(cached)'
      });
      
      updateSideMap(sideMap, pkg, cached.isClient);
    }
    return;
  }
  
  // Stage A: Fast scan
  const candidates = await fastScan(filePath, packageNames);
  
  if (candidates.length === 0) {
    return;
  }
  
  // Stage B: AST verification
  try {
    const content = await readFile(filePath, 'utf-8');
    const imports = parseFile(content, filePath);
    const isClient = detectUseClient(content);
    
    // Track found imports
    const foundPackages = new Set<string>();
    
    for (const imp of imports) {
      if (packageNames.includes(imp.packageName)) {
        foundPackages.add(imp.packageName);
        
        addEvidence(evidenceMap, imp.packageName, {
          file: filePath,
          line: imp.line,
          type: imp.type,
          snippet: extractSnippet(content, imp.line)
        });
        
        updateSideMap(sideMap, imp.packageName, isClient);
      }
    }
    
    // Cache results
    if (stats) {
      await cache.set(filePath, {
        hash: cache.createHash(content),
        mtime: stats.mtime,
        imports: Array.from(foundPackages),
        isClient
      });
    }
  } catch {
    // If AST parsing fails, fall back to string scan results with lower confidence
    for (const pkg of candidates) {
      addEvidence(evidenceMap, pkg, {
        file: filePath,
        type: 'string_reference',
        snippet: '(detected via string scan)'
      });
    }
  }
}

/**
 * Add evidence to the map
 */
function addEvidence(
  map: Map<string, EvidenceEntry[]>,
  pkg: string,
  evidence: EvidenceEntry
): void {
  const existing = map.get(pkg) || [];
  existing.push(evidence);
  map.set(pkg, existing);
}

/**
 * Update side map with client/server info
 */
function updateSideMap(
  map: Map<string, Map<string, boolean>>,
  pkg: string,
  isClient?: boolean
): void {
  const sides = map.get(pkg) || new Map<string, boolean>();
  
  if (isClient) {
    sides.set('client', true);
  } else {
    sides.set('server', true);
  }
  
  map.set(pkg, sides);
}

/**
 * Extract code snippet around a line
 */
function extractSnippet(content: string, line: number): string {
  const lines = content.split('\n');
  const index = line - 1;
  
  if (index >= 0 && index < lines.length) {
    return lines[index].trim().slice(0, 100);
  }
  
  return '';
}
