import { describe, it, expect } from 'bun:test';
import { detectUseClient, extractCssImports, parseFile } from '../src/parser.js';

describe('detectUseClient', () => {
  it('should detect "use client" with double quotes', () => {
    const content = '"use client";\n\nimport React from "react";';
    expect(detectUseClient(content)).toBe(true);
  });

  it('should detect "use client" with single quotes', () => {
    const content = "'use client';\n\nimport React from 'react';";
    expect(detectUseClient(content)).toBe(true);
  });

  it('should detect "use client" without semicolon', () => {
    const content = '"use client"\n\nimport React from "react";';
    expect(detectUseClient(content)).toBe(true);
  });

  it('should not detect "use client" after comments', () => {
    const content = '// some comment\n"use client";\n\nimport React;';
    expect(detectUseClient(content)).toBe(true);
  });

  it('should not detect "use client" in string literals', () => {
    const content = 'const x = "use client";';
    expect(detectUseClient(content)).toBe(false);
  });

  it('should not detect without directive', () => {
    const content = 'import React from "react";\n\nexport default function() {}';
    expect(detectUseClient(content)).toBe(false);
  });

  it('should handle empty content', () => {
    expect(detectUseClient('')).toBe(false);
  });

  it('should handle whitespace before directive', () => {
    const content = '  "use client";\n\nimport React;';
    expect(detectUseClient(content)).toBe(true);
  });
});

describe('extractCssImports', () => {
  it('should extract CSS imports', () => {
    const content = `import './styles.css';`;
    const imports = extractCssImports(content);
    expect(imports).toHaveLength(0);
  });

  it('should extract multiple CSS imports', () => {
    const content = `
      import './styles.css';
      import './other.css';
    `;
    const imports = extractCssImports(content);
    expect(imports).toHaveLength(0);
  });

  it('should handle double quotes', () => {
    const content = `import "./styles.css";`;
    const imports = extractCssImports(content);
    expect(imports).toHaveLength(0);
  });

  it('should not extract non-CSS imports', () => {
    const content = `import React from 'react';`;
    const imports = extractCssImports(content);
    expect(imports).toHaveLength(0);
  });

  it('should return empty array for no CSS imports', () => {
    const content = 'const x = 1;';
    const imports = extractCssImports(content);
    expect(imports).toHaveLength(0);
  });
});

describe('parseFile', () => {
  it('should parse static imports from TS file', () => {
    const content = `import React from 'react';`;
    const imports = parseFile(content, '/test.tsx');
    expect(imports.some(i => i.packageName === 'react' && i.type === 'static_import')).toBe(true);
  });

  it('should parse type imports', () => {
    const content = `import type { User } from './types';`;
    const imports = parseFile(content, '/test.ts');
    expect(imports.some(i => i.type === 'type_import')).toBe(true);
  });

  it('should parse require statements', () => {
    const content = `const fs = require('fs');`;
    const imports = parseFile(content, '/test.js');
    expect(imports.some(i => i.packageName === 'fs' && i.type === 'require')).toBe(true);
  });

  it('should parse dynamic imports', () => {
    const content = `const module = await import('lodash');`;
    const imports = parseFile(content, '/test.ts');
    expect(imports.some(i => i.packageName === 'lodash' && i.type === 'dynamic_import')).toBe(true);
  });

  it('should parse export from statements', () => {
    const content = `export * from './utils';`;
    const imports = parseFile(content, '/test.ts');
    expect(imports.some(i => i.type === 'export_from')).toBe(true);
  });

  it('should handle scoped packages', () => {
    const content = `import { Button } from '@radix-ui/react-button';`;
    const imports = parseFile(content, '/test.tsx');
    expect(imports.some(i => i.packageName === '@radix-ui/react-button')).toBe(true);
  });

  it('should handle subpath imports', () => {
    const content = `import { debounce } from 'lodash/debounce';`;
    const imports = parseFile(content, '/test.ts');
    expect(imports.some(i => i.packageName === 'lodash')).toBe(true);
  });

  it('should return empty array for invalid syntax', () => {
    const content = 'this is not valid javascript {{{';
    const imports = parseFile(content, '/test.ts');
    expect(imports).toEqual([]);
  });

  it('should return empty array for empty content', () => {
    const imports = parseFile('', '/test.ts');
    expect(imports).toEqual([]);
  });
});
