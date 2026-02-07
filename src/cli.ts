#!/usr/bin/env node

import { Command } from 'commander';
import { resolve } from 'path';
import { runScan } from './analyzer.js';
import { formatOutput, formatExplanation } from './output.js';
import { findPackageJson } from './package.js';
import type { ScanOptions } from './types.js';

const program = new Command();

program
  .name('midna')
  .description('A cautious, Next.js-aware dependency auditor')
  .version('1.0.0');

program
  .command('scan')
  .description('Run full dependency scan and print report')
  .option('-j, --json', 'Output as JSON')
  .option('-o, --output <path>', 'Write report to file')
  .option('-f, --format <format>', 'Output format (table|json)', 'table')
  .option('-w, --workspace <name>', 'Scan specific workspace')
  .option('-a, --all-workspaces', 'Scan all workspaces')
  .option('-s, --since <ref>', 'Only analyze files changed since git ref')
  .option('-i, --include <pattern>', 'Additional include patterns', collect, [])
  .option('-e, --exclude <pattern>', 'Exclude patterns', collect, [])
  .option('--no-config', 'Disable config file scanning')
  .option('--no-cache', 'Disable cache')
  .option('--cache-dir <path>', 'Custom cache directory')
  .option('--fail-on-unused', 'Exit non-zero if unused dependencies exist')
  .option('--fail-on-uncertain', 'Exit non-zero if uncertain dependencies exist')
  .option('--min-confidence-unused <n>', 'Threshold for UNUSED (0-1)', '0.30')
  .option('--min-confidence-used <n>', 'Threshold for USED (0-1)', '0.70')
  .option('-q, --quiet', 'Only print summary')
  .option('-v, --verbose', 'Print debug details')
  .option('--cwd <path>', 'Working directory', process.cwd())
  .action(async (options) => {
    try {
      const cwd = resolve(options.cwd);
      
      // Validate package.json exists
      const packagePath = await findPackageJson(cwd);
      if (!packagePath) {
        console.error('Error: No package.json found');
        process.exit(2);
      }
      
      const scanOptions: ScanOptions = {
        cwd,
        include: options.include,
        exclude: options.exclude,
        noConfig: !options.config,
        noCache: !options.cache,
        cacheDir: options.cacheDir,
        minConfidenceUnused: parseFloat(options.minConfidenceUnused),
        minConfidenceUsed: parseFloat(options.minConfidenceUsed),
        workspace: options.workspace,
        allWorkspaces: options.allWorkspaces,
        since: options.since,
        verbose: options.verbose
      };
      
      if (options.verbose) {
        console.error('Scan options:', scanOptions);
      }
      
      const result = await runScan(scanOptions);
      
      // Output results
      const output = formatOutput(result, options.json ? 'json' : options.format);
      
      if (options.output) {
        const { writeFile } = await import('fs/promises');
        await writeFile(options.output, output, 'utf-8');
        if (!options.quiet) {
          console.log(`Report written to ${options.output}`);
        }
      } else {
        console.log(output);
      }
      
      // Exit codes
      if (options.failOnUnused && result.totals.unused > 0) {
        process.exit(1);
      }
      if (options.failOnUncertain && result.totals.uncertain > 0) {
        process.exit(1);
      }
      
      process.exit(0);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(2);
    }
  });

program
  .command('explain <package>')
  .description('Show detailed evidence for a specific package')
  .option('--cwd <path>', 'Working directory', process.cwd())
  .option('--no-cache', 'Disable cache')
  .option('--cache-dir <path>', 'Custom cache directory')
  .option('-v, --verbose', 'Print debug details')
  .action(async (packageName, options) => {
    try {
      const cwd = resolve(options.cwd);
      
      const scanOptions: ScanOptions = {
        cwd,
        noCache: !options.cache,
        cacheDir: options.cacheDir,
        minConfidenceUnused: 0.30,
        minConfidenceUsed: 0.70,
        verbose: options.verbose
      };
      
      const result = await runScan(scanOptions);
      
      const pkg = result.packages.find(p => p.name === packageName);
      
      if (!pkg) {
        console.error(`Package "${packageName}" not found in dependencies`);
        process.exit(2);
      }
      
      console.log(formatExplanation(pkg));
      process.exit(0);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(2);
    }
  });

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

program.parse();
