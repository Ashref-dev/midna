import type { EvidenceEntry, EvidenceType, DependencyStatus, UsageSide } from './types.js';

/**
 * Confidence scores for different evidence types
 */
const EVIDENCE_SCORES: Record<EvidenceType, number> = {
  static_import: 1.0,
  type_import: 0.9,
  export_from: 1.0,
  require: 1.0,
  dynamic_import: 0.8,
  css_import: 0.9,
  config_reference: 0.4,
  string_reference: 0.3,
  plugin_reference: 0.5
};

/**
 * Calculate confidence score based on evidence
 */
export function calculateConfidence(evidence: EvidenceEntry[]): number {
  if (evidence.length === 0) {
    return 0;
  }

  const maxScore = Math.max(...evidence.map(e => EVIDENCE_SCORES[e.type] || 0.5));

  const evidenceBoost = Math.min((evidence.length - 1) * 0.05, 0.15);

  return Math.min(maxScore + evidenceBoost, 1.0);
}

/**
 * Classify dependency based on confidence score and thresholds
 */
export function classifyDependency(
  confidence: number,
  minUnused: number,
  minUsed: number
): DependencyStatus {
  if (confidence >= minUsed) {
    return 'used';
  }
  if (confidence < minUnused) {
    return 'unused';
  }
  return 'uncertain';
}

/**
 * Determine usage side (client/server/both/unknown)
 */
export function determineUsageSide(results: Map<string, boolean>): UsageSide {
  const hasClient = results.get('client') || false;
  const hasServer = results.get('server') || false;
  
  if (hasClient && hasServer) return 'both';
  if (hasClient) return 'client';
  if (hasServer) return 'server';
  return 'unknown';
}

/**
 * Add safety notes for uncertain classifications
 */
export function generateNotes(
  status: DependencyStatus,
  evidence: EvidenceEntry[],
  section: string
): string[] {
  const notes: string[] = [];
  
  if (status === 'uncertain') {
    const configRefs = evidence.filter(e => e.type === 'config_reference');
    const stringRefs = evidence.filter(e => e.type === 'string_reference');
    const pluginRefs = evidence.filter(e => e.type === 'plugin_reference');
    
    if (configRefs.length > 0) {
      notes.push('Referenced in config files but not verified as imported');
    }
    if (stringRefs.length > 0) {
      notes.push('Only found as string literal references');
    }
    if (pluginRefs.length > 0) {
      notes.push('Possibly used as plugin - verify manually');
    }
    if (evidence.length === 0) {
      notes.push('No usage evidence found');
    }
  }
  
  if (section === 'peerDependencies') {
    notes.push('Peer dependency - do not remove without checking dependents');
  }
  
  return notes;
}

/**
 * Score result for sorting (used > uncertain > unused)
 */
export function getSortPriority(status: DependencyStatus): number {
  switch (status) {
    case 'used': return 0;
    case 'uncertain': return 1;
    case 'unused': return 2;
  }
}
