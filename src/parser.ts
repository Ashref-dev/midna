import { parseSync } from '@swc/core';
import type { ParsedImport } from './types.js';

/**
 * Parse a file using SWC and extract all imports
 * Stage B of the two-stage pipeline
 */
export function parseFile(content: string, filePath: string): ParsedImport[] {
  const imports: ParsedImport[] = [];
  
  try {
    const ast = parseSync(content, {
      syntax: filePath.endsWith('.ts') || filePath.endsWith('.tsx') ? 'typescript' : 'ecmascript',
      tsx: filePath.endsWith('.tsx'),
      jsx: filePath.endsWith('.jsx'),
      target: 'es2022'
    });
    
    extractImportsFromAST(ast, imports);
  } catch {
    // If parsing fails, return empty array
    // The fast scan already caught potential references
  }
  
  return imports;
}

/**
 * Recursively extract imports from AST
 */
function extractImportsFromAST(node: any, imports: ParsedImport[]): void {
  if (!node || typeof node !== 'object') return;
  
  // Handle import declarations
  if (node.type === 'ImportDeclaration' && node.source?.value) {
    imports.push({
      packageName: normalizePackageName(node.source.value),
      type: node.importKind === 'type' ? 'type_import' : 'static_import',
      line: node.span?.start || 0,
      isTypeOnly: node.importKind === 'type'
    });
  }
  
  // Handle export from declarations
  if (node.type === 'ExportAllDeclaration' || node.type === 'ExportNamedDeclaration') {
    if (node.source?.value) {
      imports.push({
        packageName: normalizePackageName(node.source.value),
        type: 'export_from',
        line: node.span?.start || 0
      });
    }
  }
  
  // Handle dynamic imports
  if (node.type === 'ImportExpression' && node.source?.value) {
    imports.push({
      packageName: normalizePackageName(node.source.value),
      type: 'dynamic_import',
      line: node.span?.start || 0
    });
  }
  
  // Handle require calls
  if (node.type === 'CallExpression' && 
      node.callee?.type === 'Identifier' && 
      node.callee?.value === 'require' &&
      node.arguments?.[0]?.expression?.value) {
    imports.push({
      packageName: normalizePackageName(node.arguments[0].expression.value),
      type: 'require',
      line: node.span?.start || 0
    });
  }
  
  // Recursively traverse all properties
  for (const key in node) {
    if (key === 'span' || key === 'parent') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      value.forEach(child => extractImportsFromAST(child, imports));
    } else if (value && typeof value === 'object') {
      extractImportsFromAST(value, imports);
    }
  }
}

/**
 * Check if content has "use client" directive
 */
export function detectUseClient(content: string): boolean {
  const lines = content.split('\n');
  for (const line of lines.slice(0, 20)) {
    const trimmed = line.trim();
    // Handle both with and without semicolon
    const withoutSemi = trimmed.replace(/;$/, '');
    if (withoutSemi === '"use client"' || withoutSemi === "'use client'") {
      return true;
    }
    if (trimmed && !trimmed.startsWith('//')) {
      break;
    }
  }
  return false;
}

/**
 * Extract CSS imports from file content
 */
export function extractCssImports(content: string): ParsedImport[] {
  const imports: ParsedImport[] = [];
  const lines = content.split('\n');
  
  const cssImportPattern = /import\s+['"](.+?\.css)['"];?/;
  
  lines.forEach((line, index) => {
    const match = line.match(cssImportPattern);
    if (match) {
      imports.push({
        packageName: normalizePackageName(match[1]),
        type: 'css_import',
        line: index + 1
      });
    }
  });
  
  return imports;
}

/**
 * Normalize package name from import path
 */
function normalizePackageName(importPath: string): string {
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
  }
  
  const parts = importPath.split('/');
  return parts[0];
}
