import { describe, it, expect } from 'bun:test';
import { 
  calculateConfidence, 
  classifyDependency, 
  determineUsageSide, 
  generateNotes,
  getSortPriority 
} from '../src/confidence.js';
import type { EvidenceEntry } from '../src/types.js';

describe('calculateConfidence', () => {
  it('should return 0 for empty evidence', () => {
    expect(calculateConfidence([])).toBe(0);
  });

  it('should calculate confidence for static import (1.0)', () => {
    const evidence: EvidenceEntry[] = [
      { file: '/test.ts', type: 'static_import', line: 1 }
    ];
    expect(calculateConfidence(evidence)).toBe(1.0);
  });

  it('should calculate confidence for type import (0.9)', () => {
    const evidence: EvidenceEntry[] = [
      { file: '/test.ts', type: 'type_import', line: 1 }
    ];
    expect(calculateConfidence(evidence)).toBe(0.9);
  });

  it('should calculate confidence for string reference (0.3)', () => {
    const evidence: EvidenceEntry[] = [
      { file: '/test.ts', type: 'string_reference', line: 1 }
    ];
    expect(calculateConfidence(evidence)).toBe(0.3);
  });

  it('should boost confidence with multiple pieces of evidence', () => {
    const evidence: EvidenceEntry[] = [
      { file: '/test.ts', type: 'static_import', line: 1 },
      { file: '/test2.ts', type: 'static_import', line: 2 },
      { file: '/test3.ts', type: 'static_import', line: 3 }
    ];
    expect(calculateConfidence(evidence)).toBe(1.0);
  });

  it('should use highest confidence evidence when mixed', () => {
    const evidence: EvidenceEntry[] = [
      { file: '/test.ts', type: 'string_reference', line: 1 },
      { file: '/test2.ts', type: 'static_import', line: 2 }
    ];
    expect(calculateConfidence(evidence)).toBe(1.0);
  });

  it('should handle unknown evidence types with default 0.5', () => {
    const evidence: EvidenceEntry[] = [
      { file: '/test.ts', type: 'unknown_type' as any, line: 1 }
    ];
    expect(calculateConfidence(evidence)).toBe(0.5);
  });
});

describe('classifyDependency', () => {
  it('should classify as used when confidence >= minUsed', () => {
    expect(classifyDependency(0.75, 0.3, 0.7)).toBe('used');
    expect(classifyDependency(0.7, 0.3, 0.7)).toBe('used');
    expect(classifyDependency(1.0, 0.3, 0.7)).toBe('used');
  });

  it('should classify as unused when confidence < minUnused', () => {
    expect(classifyDependency(0.0, 0.3, 0.7)).toBe('unused');
    expect(classifyDependency(0.29, 0.3, 0.7)).toBe('unused');
  });

  it('should classify as uncertain when between thresholds', () => {
    expect(classifyDependency(0.3, 0.3, 0.7)).toBe('uncertain');
    expect(classifyDependency(0.5, 0.3, 0.7)).toBe('uncertain');
    expect(classifyDependency(0.69, 0.3, 0.7)).toBe('uncertain');
  });

  it('should handle custom thresholds', () => {
    expect(classifyDependency(0.5, 0.4, 0.6)).toBe('uncertain');
    expect(classifyDependency(0.65, 0.4, 0.6)).toBe('used');
    expect(classifyDependency(0.35, 0.4, 0.6)).toBe('unused');
  });
});

describe('determineUsageSide', () => {
  it('should return unknown for empty map', () => {
    expect(determineUsageSide(new Map())).toBe('unknown');
  });

  it('should return client when only client is true', () => {
    const map = new Map([['client', true]]);
    expect(determineUsageSide(map)).toBe('client');
  });

  it('should return server when only server is true', () => {
    const map = new Map([['server', true]]);
    expect(determineUsageSide(map)).toBe('server');
  });

  it('should return both when client and server are true', () => {
    const map = new Map([
      ['client', true],
      ['server', true]
    ]);
    expect(determineUsageSide(map)).toBe('both');
  });

  it('should handle false values correctly', () => {
    const map = new Map([
      ['client', false],
      ['server', true]
    ]);
    expect(determineUsageSide(map)).toBe('server');
  });
});

describe('generateNotes', () => {
  it('should return empty array for used status', () => {
    const evidence: EvidenceEntry[] = [
      { file: '/test.ts', type: 'static_import', line: 1 }
    ];
    expect(generateNotes('used', evidence, 'dependencies')).toEqual([]);
  });

  it('should add note for config references when uncertain', () => {
    const evidence: EvidenceEntry[] = [
      { file: '/test.ts', type: 'config_reference', line: 1 }
    ];
    const notes = generateNotes('uncertain', evidence, 'dependencies');
    expect(notes).toContain('Referenced in config files but not verified as imported');
  });

  it('should add note for string references when uncertain', () => {
    const evidence: EvidenceEntry[] = [
      { file: '/test.ts', type: 'string_reference', line: 1 }
    ];
    const notes = generateNotes('uncertain', evidence, 'dependencies');
    expect(notes).toContain('Only found as string literal references');
  });

  it('should add note for plugin references when uncertain', () => {
    const evidence: EvidenceEntry[] = [
      { file: '/test.ts', type: 'plugin_reference', line: 1 }
    ];
    const notes = generateNotes('uncertain', evidence, 'dependencies');
    expect(notes).toContain('Possibly used as plugin - verify manually');
  });

  it('should add note for no evidence when uncertain', () => {
    const evidence: EvidenceEntry[] = [];
    const notes = generateNotes('uncertain', evidence, 'dependencies');
    expect(notes).toContain('No usage evidence found');
  });

  it('should add peer dependency warning for peerDependencies section', () => {
    const evidence: EvidenceEntry[] = [];
    const notes = generateNotes('unused', evidence, 'peerDependencies');
    expect(notes).toContain('Peer dependency - do not remove without checking dependents');
  });

  it('should combine multiple notes when uncertain', () => {
    const evidence: EvidenceEntry[] = [
      { file: '/test.ts', type: 'config_reference', line: 1 },
      { file: '/test2.ts', type: 'string_reference', line: 2 }
    ];
    const notes = generateNotes('uncertain', evidence, 'peerDependencies');
    expect(notes).toContain('Referenced in config files but not verified as imported');
    expect(notes).toContain('Only found as string literal references');
    expect(notes).toContain('Peer dependency - do not remove without checking dependents');
  });
});

describe('getSortPriority', () => {
  it('should return 0 for used', () => {
    expect(getSortPriority('used')).toBe(0);
  });

  it('should return 1 for uncertain', () => {
    expect(getSortPriority('uncertain')).toBe(1);
  });

  it('should return 2 for unused', () => {
    expect(getSortPriority('unused')).toBe(2);
  });
});
