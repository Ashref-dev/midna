import type { ScanResult, PackageResult, OutputFormat } from './types.js';

/**
 * Format result as JSON
 */
export function formatJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Format result as table for CLI output
 */
export function formatTable(result: ScanResult): string {
  const lines: string[] = [];
  
  // Header
  lines.push('');
  lines.push('═'.repeat(80));
  lines.push('  Midna - Dependency Usage Report');
  lines.push('═'.repeat(80));
  lines.push('');
  
  // Summary
  const { totals } = result;
  lines.push(`  Repository: ${result.repoRoot}`);
  lines.push(`  Timestamp: ${new Date(result.timestamp).toLocaleString()}`);
  lines.push('');
  lines.push(`  ${'─'.repeat(40)}`);
  lines.push(`  Summary:`);
  lines.push(`  ${'─'.repeat(40)}`);
  lines.push(`    USED:      ${totals.used.toString().padStart(3)}`);
  lines.push(`    UNUSED:    ${totals.unused.toString().padStart(3)}`);
  lines.push(`    UNCERTAIN: ${totals.uncertain.toString().padStart(3)}`);
  lines.push(`  ${'─'.repeat(40)}`);
  lines.push('');
  
  // Safe removal candidates
  const safeToRemove = result.packages.filter(
    p => p.status === 'unused' && p.confidence < 0.3 && p.section !== 'peerDependencies'
  );
  
  if (safeToRemove.length > 0) {
    lines.push('  ⚡ Safe Removal Candidates:');
    lines.push(`  ${'─'.repeat(40)}`);
    safeToRemove.forEach(pkg => {
      lines.push(`    • ${pkg.name} (${pkg.section})`);
    });
    lines.push('');
  }
  
  // Table header
  lines.push('  Detailed Results:');
  lines.push('');
  lines.push(`  ${'─'.repeat(78)}`);
  lines.push(`  ${'Package'.padEnd(25)} │ ${'Status'.padEnd(10)} │ ${'Conf'.padEnd(6)} │ ${'Side'.padEnd(8)} │ ${'Section'.padEnd(12)}`);
  lines.push(`  ${'─'.repeat(78)}`);
  
  // Sort: unused first, then uncertain, then used
  const sorted = [...result.packages].sort((a, b) => {
    const priorityA = getStatusPriority(a.status);
    const priorityB = getStatusPriority(b.status);
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.name.localeCompare(b.name);
  });
  
  // Table rows
  for (const pkg of sorted) {
    const statusIcon = pkg.status === 'used' ? '✓' : pkg.status === 'unused' ? '✗' : '?';
    const status = `${statusIcon} ${pkg.status}`;
    const conf = `${Math.round(pkg.confidence * 100)}%`;
    
    lines.push(
      `  ${pkg.name.slice(0, 25).padEnd(25)} │ ${status.padEnd(10)} │ ${conf.padEnd(6)} │ ${pkg.side.padEnd(8)} │ ${pkg.section.slice(0, 12).padEnd(12)}`
    );
  }
  
  lines.push(`  ${'─'.repeat(78)}`);
  lines.push('');
  
  // Notes
  const withNotes = result.packages.filter(p => p.notes.length > 0);
  if (withNotes.length > 0) {
    lines.push('  Notes:');
    lines.push('');
    for (const pkg of withNotes.slice(0, 10)) {
      lines.push(`  ${pkg.name}:`);
      for (const note of pkg.notes) {
        lines.push(`    • ${note}`);
      }
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

/**
 * Format single package explanation
 */
export function formatExplanation(pkg: PackageResult): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('═'.repeat(80));
  lines.push(`  Package: ${pkg.name}`);
  lines.push('═'.repeat(80));
  lines.push('');
  
  lines.push(`  Section: ${pkg.section}`);
  lines.push(`  Status: ${pkg.status.toUpperCase()}`);
  lines.push(`  Confidence: ${Math.round(pkg.confidence * 100)}%`);
  lines.push(`  Usage Side: ${pkg.side}`);
  lines.push('');
  
  if (pkg.notes.length > 0) {
    lines.push('  Notes:');
    lines.push(`  ${'─'.repeat(40)}`);
    for (const note of pkg.notes) {
      lines.push(`    • ${note}`);
    }
    lines.push('');
  }
  
  if (pkg.evidence.length > 0) {
    lines.push('  Evidence:');
    lines.push(`  ${'─'.repeat(40)}`);
    lines.push('');
    
    for (const ev of pkg.evidence) {
      lines.push(`    Type: ${ev.type}`);
      lines.push(`    File: ${ev.file}`);
      if (ev.line) {
        lines.push(`    Line: ${ev.line}`);
      }
      if (ev.snippet) {
        lines.push(`    Snippet: ${ev.snippet.slice(0, 60)}${ev.snippet.length > 60 ? '...' : ''}`);
      }
      lines.push('');
    }
  } else {
    lines.push('  No evidence found for this package.');
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Get status priority for sorting
 */
function getStatusPriority(status: string): number {
  switch (status) {
    case 'unused': return 0;
    case 'uncertain': return 1;
    case 'used': return 2;
    default: return 3;
  }
}

/**
 * Format output based on format option
 */
export function formatOutput(result: ScanResult, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return formatJson(result);
    case 'table':
    default:
      return formatTable(result);
  }
}
