import { describe, it, expect } from 'bun:test';
import { 
  extractDependencies, 
  getAllDependencyNames, 
  isValidPackageName,
  getDependencySection 
} from '../src/package.js';
import type { PackageJson } from '../src/types.js';

describe('extractDependencies', () => {
  it('should extract from dependencies', () => {
    const pkg: PackageJson = {
      dependencies: {
        react: '^18.0.0',
        lodash: '^4.17.0'
      }
    };
    const deps = extractDependencies(pkg);
    expect(deps).toHaveLength(2);
    expect(deps.some(d => d.name === 'react' && d.section === 'dependencies')).toBe(true);
    expect(deps.some(d => d.name === 'lodash' && d.section === 'dependencies')).toBe(true);
  });

  it('should extract from devDependencies', () => {
    const pkg: PackageJson = {
      devDependencies: {
        typescript: '^5.0.0',
        jest: '^29.0.0'
      }
    };
    const deps = extractDependencies(pkg);
    expect(deps).toHaveLength(2);
    expect(deps.some(d => d.name === 'typescript' && d.section === 'devDependencies')).toBe(true);
  });

  it('should extract from all sections', () => {
    const pkg: PackageJson = {
      dependencies: { react: '^18.0.0' },
      devDependencies: { typescript: '^5.0.0' },
      optionalDependencies: { fsevents: '^2.0.0' },
      peerDependencies: { react: '^18.0.0' }
    };
    const deps = extractDependencies(pkg);
    expect(deps).toHaveLength(4);
  });

  it('should handle empty package.json', () => {
    const pkg: PackageJson = {};
    const deps = extractDependencies(pkg);
    expect(deps).toHaveLength(0);
  });

  it('should include version info', () => {
    const pkg: PackageJson = {
      dependencies: { react: '^18.0.0' }
    };
    const deps = extractDependencies(pkg);
    expect(deps[0].version).toBe('^18.0.0');
  });
});

describe('getAllDependencyNames', () => {
  it('should return unique names from all sections', () => {
    const pkg: PackageJson = {
      dependencies: { react: '^18.0.0' },
      devDependencies: { typescript: '^5.0.0' }
    };
    const names = getAllDependencyNames(pkg);
    expect(names).toContain('react');
    expect(names).toContain('typescript');
    expect(names).toHaveLength(2);
  });

  it('should deduplicate across sections', () => {
    const pkg: PackageJson = {
      dependencies: { react: '^18.0.0' },
      peerDependencies: { react: '^18.0.0' }
    };
    const names = getAllDependencyNames(pkg);
    expect(names).toHaveLength(1);
    expect(names[0]).toBe('react');
  });

  it('should return empty array for empty package', () => {
    const pkg: PackageJson = {};
    const names = getAllDependencyNames(pkg);
    expect(names).toHaveLength(0);
  });
});

describe('isValidPackageName', () => {
  it('should validate simple package names', () => {
    expect(isValidPackageName('react')).toBe(true);
    expect(isValidPackageName('lodash')).toBe(true);
    expect(isValidPackageName('express')).toBe(true);
    expect(isValidPackageName('my-package')).toBe(true);
    expect(isValidPackageName('my_package')).toBe(true);
  });

  it('should validate scoped packages', () => {
    expect(isValidPackageName('@radix-ui/react-button')).toBe(true);
    expect(isValidPackageName('@types/react')).toBe(true);
    expect(isValidPackageName('@company/tool')).toBe(true);
  });

  it('should reject invalid names', () => {
    expect(isValidPackageName('')).toBe(false);
    expect(isValidPackageName('.hidden')).toBe(false);
    expect(isValidPackageName('_private')).toBe(false);
    expect(isValidPackageName('node_modules')).toBe(false);
  });

  it('should reject names starting with dot or underscore', () => {
    expect(isValidPackageName('.dot')).toBe(false);
    expect(isValidPackageName('_underscore')).toBe(false);
  });

  it('should reject names with spaces', () => {
    expect(isValidPackageName('my package')).toBe(false);
  });

  it('should reject names that are too long', () => {
    const longName = 'a'.repeat(215);
    expect(isValidPackageName(longName)).toBe(false);
  });

  it('should reject invalid scoped packages', () => {
    expect(isValidPackageName('@scope')).toBe(false);
    expect(isValidPackageName('@/package')).toBe(false);
  });
});

describe('getDependencySection', () => {
  it('should identify dependencies section', () => {
    const pkg: PackageJson = {
      dependencies: { react: '^18.0.0' }
    };
    expect(getDependencySection(pkg, 'react')).toBe('dependencies');
  });

  it('should identify devDependencies section', () => {
    const pkg: PackageJson = {
      devDependencies: { typescript: '^5.0.0' }
    };
    expect(getDependencySection(pkg, 'typescript')).toBe('devDependencies');
  });

  it('should identify optionalDependencies section', () => {
    const pkg: PackageJson = {
      optionalDependencies: { fsevents: '^2.0.0' }
    };
    expect(getDependencySection(pkg, 'fsevents')).toBe('optionalDependencies');
  });

  it('should identify peerDependencies section', () => {
    const pkg: PackageJson = {
      peerDependencies: { react: '^18.0.0' }
    };
    expect(getDependencySection(pkg, 'react')).toBe('peerDependencies');
  });

  it('should return null for non-existent package', () => {
    const pkg: PackageJson = {
      dependencies: { react: '^18.0.0' }
    };
    expect(getDependencySection(pkg, 'lodash')).toBeNull();
  });

  it('should return null for empty package', () => {
    const pkg: PackageJson = {};
    expect(getDependencySection(pkg, 'react')).toBeNull();
  });

  it('should prioritize dependencies over peerDependencies', () => {
    const pkg: PackageJson = {
      dependencies: { react: '^18.0.0' },
      peerDependencies: { react: '^18.0.0' }
    };
    expect(getDependencySection(pkg, 'react')).toBe('dependencies');
  });
});
