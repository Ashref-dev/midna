import { describe, it, expect } from 'bun:test';
import { isConfigFile, normalizePackageName, hasUseClient } from '../src/scanner.js';

describe('isConfigFile', () => {
  it('should identify next.config.js as config file', () => {
    expect(isConfigFile('/project/next.config.js')).toBe(true);
    expect(isConfigFile('/project/next.config.ts')).toBe(true);
    expect(isConfigFile('/project/next.config.mjs')).toBe(true);
  });

  it('should identify tailwind.config as config file', () => {
    expect(isConfigFile('/project/tailwind.config.js')).toBe(true);
    expect(isConfigFile('/project/tailwind.config.ts')).toBe(true);
  });

  it('should identify tsconfig.json as config file', () => {
    expect(isConfigFile('/project/tsconfig.json')).toBe(true);
  });

  it('should identify middleware.ts as config file', () => {
    expect(isConfigFile('/project/middleware.ts')).toBe(true);
    expect(isConfigFile('/project/middleware.js')).toBe(true);
  });

  it('should identify instrumentation.ts as config file', () => {
    expect(isConfigFile('/project/instrumentation.ts')).toBe(true);
  });

  it('should identify eslint config files', () => {
    expect(isConfigFile('/project/eslint.config.js')).toBe(true);
    expect(isConfigFile('/project/.eslintrc.json')).toBe(true);
  });

  it('should not identify regular source files as config', () => {
    expect(isConfigFile('/project/src/index.ts')).toBe(false);
    expect(isConfigFile('/project/app/page.tsx')).toBe(false);
    expect(isConfigFile('/project/components/Button.tsx')).toBe(false);
  });

  it('should not identify package.json as config', () => {
    expect(isConfigFile('/project/package.json')).toBe(false);
  });
});

describe('normalizePackageName', () => {
  it('should return scoped package name as-is', () => {
    expect(normalizePackageName('@radix-ui/react-button')).toBe('@radix-ui/react-button');
    expect(normalizePackageName('@types/react')).toBe('@types/react');
    expect(normalizePackageName('@company/internal-tool')).toBe('@company/internal-tool');
  });

  it('should extract base package from subpath imports', () => {
    expect(normalizePackageName('lodash/debounce')).toBe('lodash');
    expect(normalizePackageName('react-dom/client')).toBe('react-dom');
    expect(normalizePackageName('date-fns/addDays')).toBe('date-fns');
  });

  it('should return simple package name as-is', () => {
    expect(normalizePackageName('react')).toBe('react');
    expect(normalizePackageName('lodash')).toBe('lodash');
    expect(normalizePackageName('express')).toBe('express');
  });

  it('should handle scoped packages with subpaths', () => {
    expect(normalizePackageName('@radix-ui/react-button/dist/index')).toBe('@radix-ui/react-button');
    expect(normalizePackageName('@types/node/fs')).toBe('@types/node');
  });

  it('should handle edge cases', () => {
    expect(normalizePackageName('')).toBe('');
    expect(normalizePackageName('@')).toBe('@');
    expect(normalizePackageName('@scope/')).toBe('@scope/');
  });
});

describe('hasUseClient', () => {
  it('should detect "use client" with double quotes', () => {
    const content = '"use client";\n\nimport React from "react";';
    expect(hasUseClient(content)).toBe(true);
  });

  it('should detect "use client" with single quotes', () => {
    const content = "'use client';\n\nimport React from 'react';";
    expect(hasUseClient(content)).toBe(true);
  });

  it('should detect "use client" without semicolon', () => {
    const content = '"use client"\n\nimport React from "react";';
    expect(hasUseClient(content)).toBe(true);
  });

  it('should detect in first 10 lines only', () => {
    const lines = Array(11).fill('// comment');
    lines[10] = '"use client";';
    const content = lines.join('\n');
    expect(hasUseClient(content)).toBe(false);
  });

  it('should not detect in string literals', () => {
    const content = 'const directive = "use client";';
    expect(hasUseClient(content)).toBe(false);
  });

  it('should handle empty content', () => {
    expect(hasUseClient('')).toBe(false);
  });
});
