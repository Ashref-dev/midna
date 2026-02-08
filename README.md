# midna.ashref.tn

A cautious, Next.js-aware dependency auditor that tells you what you can safely remove, with evidence.

Made by Ashref (ashref.tn)

## Overview

Midna analyzes your JavaScript/TypeScript repository to identify which npm dependencies are actually being used. It uses a conservative confidence model that prioritizes safety over aggressive removal, helping teams clean up their dependency trees without breaking their applications.

### Key Features

- **Two-Stage Scan Pipeline**: Fast string scanning + AST verification for accuracy
- **Confidence-Based Classification**: USED (>=70%), UNCERTAIN (30-69%), UNUSED (<30%)
- **Next.js Awareness**: Detects "use client" directives and client/server usage
- **Evidence Collection**: Shows file paths, line numbers, and code snippets
- **Config File Scanning**: Analyzes next.config, tailwind.config, etc.
- **Workspace Support**: Works with monorepos (npm/pnpm workspaces)
- **Caching**: Fast repeated scans with file-based caching
- **Multiple Output Formats**: Human-readable tables and machine-readable JSON

## Installation

```bash
# Run directly with npx/bunx
npx midna scan
bunx midna scan

# Or install globally
npm install -g midna
bun install -g midna
```

## Usage

### Scan Command

```bash
# Basic scan
midna scan

# Output as JSON
midna scan --json

# Save to file
midna scan --output report.json

# Fail CI if unused dependencies found
midna scan --fail-on-unused

# Verbose output
midna scan --verbose
```

### Explain Command

```bash
# Show detailed evidence for a specific package
midna explain lodash
```

## CLI Options

| Option | Description |
|--------|-------------|
| `-j, --json` | Output as JSON |
| `-o, --output <path>` | Write report to file |
| `-f, --format <format>` | Output format: `table` (default) or `json` |
| `-w, --workspace <name>` | Scan specific workspace |
| `-a, --all-workspaces` | Scan all workspaces |
| `-s, --since <ref>` | Only analyze files changed since git ref |
| `-i, --include <pattern>` | Additional include patterns |
| `-e, --exclude <pattern>` | Exclude patterns |
| `--no-config` | Disable config file scanning |
| `--no-cache` | Disable cache |
| `--cache-dir <path>` | Custom cache directory |
| `--fail-on-unused` | Exit non-zero if unused dependencies exist |
| `--fail-on-uncertain` | Exit non-zero if uncertain dependencies exist |
| `--min-confidence-unused <n>` | Threshold for UNUSED (default: 0.30) |
| `--min-confidence-used <n>` | Threshold for USED (default: 0.70) |
| `-q, --quiet` | Only print summary |
| `-v, --verbose` | Print debug details |
| `--cwd <path>` | Working directory (default: current directory) |

## Exit Codes

- `0`: Success, no violations
- `1`: Scan completed but violations triggered by flags
- `2`: Runtime error (invalid repo, parse failure, etc.)

## How It Works

### Two-Stage Pipeline

1. **Stage A - Fast Scan**: Uses regex patterns to quickly identify files that might reference dependencies
2. **Stage B - AST Verification**: Parses files with SWC to confirm actual import/require statements

### Confidence Scoring

Evidence types are weighted by confidence:

| Evidence Type | Confidence |
|--------------|------------|
| Static import/export | 100% |
| Type import | 90% |
| require() | 100% |
| Dynamic import | 80% |
| Config reference | 40% |
| String reference | 30% |

Multiple pieces of evidence boost confidence slightly (up to 15%).

### Next.js Detection

Midna detects:
- `"use client"` directives for client-side code
- Server vs client usage classification
- Config files (next.config.*, middleware.ts, etc.)

## Example Output

```
================================================================================
  Midna - Dependency Usage Report
================================================================================

  Repository: /Users/me/my-project
  Timestamp: 2/7/2026, 8:45:30 PM

  ----------------------------------------
  Summary:
  ----------------------------------------
    USED:        15
    UNUSED:       3
    UNCERTAIN:    2
  ----------------------------------------

  [SAFE] Safe Removal Candidates:
  ----------------------------------------
    - old-library (dependencies)
    - unused-utils (devDependencies)

  Detailed Results:

  ------------------------------------------------------------------------------
  Package                     | Status     | Conf   | Side     | Section       
  ------------------------------------------------------------------------------
  [X] old-library             | unused     | 0%     | unknown  | dependencies  
  [?] config-helper           | uncertain  | 50%    | unknown  | dependencies  
  [OK] react                  | used       | 100%   | both     | dependencies  
  [OK] next                   | used       | 100%   | server   | dependencies  
  ------------------------------------------------------------------------------
```

## Configuration

Midna works out of the box with zero configuration. It automatically:
- Discovers your package.json
- Scans standard Next.js directories (app/, pages/, components/, etc.)
- Analyzes config files (next.config.*, tailwind.config.*, etc.)
- Respects .gitignore patterns

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Run locally
node dist/cli.js scan
```

## Security

Midna is designed with security in mind:
- Never executes user code
- Only performs static analysis
- Does not upload any data externally
- Caches results locally only
- Uses SHA-256 for cache key hashing

## License

MIT

## Author

Ashref (ashref.tn)
