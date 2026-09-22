import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { extraRows } from './translations-extra';

const placeholders = (value: string) => [...value.matchAll(/{{(\w+)}}/g)].map((match) => match[1]).sort();

describe('translation catalogue', () => {
  it('has a non-empty value in every supported language', () => {
    for (const row of extraRows) {
      expect(row).toHaveLength(9);
      row.forEach((value) => expect(value.trim()).not.toBe(''));
    }
  });

  it('keeps interpolation variables in every translation', () => {
    for (const row of extraRows) {
      const expected = placeholders(row[0]);
      row.slice(1).forEach((value) => expect(placeholders(value)).toEqual(expected));
    }
  });

  it('does not define an English source phrase twice', () => {
    const sources = extraRows.map((row) => row[0]);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it('covers static user-facing copy in screens and shared components', () => {
    const root = process.cwd();
    const sources = new Set<string>();
    for (const file of ['src/i18n/index.tsx', 'src/i18n/translations-extra.ts']) {
      const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (ts.isArrayLiteralExpression(node) && node.elements.length === 9 && node.elements.every((element) => ts.isStringLiteral(element) || ts.isNoSubstitutionTemplateLiteral(element))) {
          sources.add((node.elements[0] as ts.StringLiteral).text);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }

    const files: string[] = [];
    const collect = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) collect(target);
        else if (entry.name.endsWith('.tsx')) files.push(target);
      }
    };
    collect(path.join(root, 'app'));
    collect(path.join(root, 'src/components'));

    const visibleProps = new Set(['label', 'title', 'subtitle', 'eyebrow', 'message', 'text', 'detail']);
    const missing = new Set<string>();
    const check = (value: string) => {
      const normalized = value.replace(/\s+/g, ' ').trim();
      if (normalized && /[A-Za-zÀ-ž]/.test(normalized) && !sources.has(normalized) && normalized !== 'S' && normalized !== 'Scholara') missing.add(normalized);
    };
    for (const file of files) {
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (ts.isJsxText(node)) check(node.text);
        if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && visibleProps.has(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer)) check(node.initializer.text);
        if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && visibleProps.has(node.name.text) && (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))) check(node.initializer.text);
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect([...missing]).toEqual([]);
  });
});
