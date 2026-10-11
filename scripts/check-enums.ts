#!/usr/bin/env node
/**
 * check-enums — CI guard against magic strings.
 *
 * A closed set of string values is declared once, as an enum-style constant:
 * a const object (`CheckStatus.Pass`) plus the type of its values
 * (`CheckStatus`). TypeScript still accepts the plain string `"pass"` wherever
 * `CheckStatus` is expected, and it accepts a fresh `"a" | "b"` union anywhere,
 * so typecheck alone cannot hold that line. This script does, with two rules:
 *
 * 1. **No literal where an enum exists.** The type checker reports the type
 *    each string literal is used as. A literal whose type is exactly one
 *    enum's value set must name the constant instead. That covers arguments,
 *    property values, array elements and return values, comparisons against
 *    a value of that type, and `case` labels. Property names, element-access
 *    keys, type positions and template literals are not values and are
 *    ignored.
 * 2. **No new string-literal union.** A union of two or more string literals in
 *    a type position must become an enum (`as const` object) or a constant
 *    list (`as const` array with `(typeof LIST)[number]`). Three forms pass:
 *    the discriminant of a tagged union (the union types a property of an
 *    object type that is itself a member of a union), key lists inside
 *    `Pick`/`Omit`/`Exclude`/`Extract`/`Record`, and the reviewed exceptions in
 *    `ALLOWED_UNIONS`, each with its reason.
 *
 * Enums are discovered, not listed: any `const X = { ... } as const` paired
 * with `type X = (typeof X)[keyof typeof X]`, in any package or script, is
 * checked from the moment it exists. A non-exported enum is enforced only in
 * its own file.
 *
 * Uses the TypeScript 6 compiler API through the `typescript-api` alias,
 * because TypeScript 7 ships no JavaScript API.
 *
 * `--json` prints the findings as JSON for tooling. Exits 0 when clean, 1 with
 * a per-finding list otherwise.
 */

import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript-api";

const root = resolve(__dirname, "..");
const asJson = process.argv.includes("--json");

const PROJECTS = [
  "packages/core/tsconfig.json",
  "packages/cli/tsconfig.json",
  "packages/report/tsconfig.json",
  "packages/mcp/tsconfig.json",
  "packages/website/tsconfig.json",
  "tsconfig.scripts.json",
];

/**
 * Files exempt from rule 1, each for a stated reason.
 * A path here is a decision, not a convenience: add one only with its reason.
 */
const EXEMPT: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /packages\/cli\/src\/package-types\.test\.ts$/,
    reason:
      "Compiles consumer code inside a template string to prove plain strings stay valid for package users.",
  },
  {
    pattern: /packages\/cli\/src\/options\.test\.ts$/,
    reason: "Tests parsing of CLI arguments, which arrive as plain strings.",
  },
  {
    pattern: /packages\/website\/src\/islands\//,
    reason:
      "Browser code. It reads report JSON and cannot import the Node-only core package.",
  },
];

/**
 * String-literal unions reviewed and kept (rule 2), keyed by file and the
 * property, parameter or alias the union types.
 */
const ALLOWED_UNIONS: Array<{ file: string; owner: string; reason: string }> = [
  {
    file: "packages/core/src/audits/access-crawl-control/ai-content-declaration.ts",
    owner: "source",
    reason: "Two display labels, written once each into the verdict text.",
  },
  {
    file: "packages/core/src/audits/agent-interfaces/ai-catalog-exists.ts",
    owner: "source",
    reason: "Two local labels, each set in one place and only reported.",
  },
  {
    file: "packages/website/src/lib/dossier-links.ts",
    owner: "view",
    reason: "GitHub URL path segments (`blob`, `tree`), not a domain value.",
  },
  {
    file: "scripts/build-audit-map.ts",
    owner: "status",
    reason:
      "Mirrors the shape of `migration-map.json`, a file format this script reads.",
  },
  {
    file: "packages/core/src/migration-map.test.ts",
    owner: "status",
    reason: "Mirrors the shape of `migration-map.json`, the file under test.",
  },
  {
    file: "packages/website/src/islands/audit-explorer.ts",
    owner: "mountExplorer",
    reason:
      "Property names of an audit record, used as sort keys in browser code.",
  },
];

const KEY_TYPE_HELPERS = new Set([
  "Pick",
  "Omit",
  "Exclude",
  "Extract",
  "Record",
]);

interface EnumDef {
  name: string;
  file: string;
  exported: boolean;
  members: Map<string, string>; // value -> member
}

const Rule = {
  Literal: "literal",
  Union: "union",
} as const;

type Rule = (typeof Rule)[keyof typeof Rule];

interface Finding {
  rule: Rule;
  file: string;
  line: number;
  start: number;
  end: number;
  message: string;
  replacement?: string;
  enumName?: string;
  enumFile?: string;
}

const relPath = (fileName: string) => relative(root, fileName);
const inRepo = (fileName: string) => {
  const rel = relPath(fileName);
  return !rel.startsWith("..") && !rel.includes("node_modules");
};

function isExported(node: ts.Node): boolean {
  return !!ts
    .getModifiers(node as ts.HasModifiers)
    ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

/** Every enum-style const object declared in this source file. */
function enumsIn(sf: ts.SourceFile): EnumDef[] {
  const consts = new Map<
    string,
    { members: Map<string, string>; exported: boolean }
  >();
  const types = new Set<string>();
  for (const stmt of sf.statements) {
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        const init = decl.initializer;
        if (
          !ts.isIdentifier(decl.name) ||
          !init ||
          !ts.isAsExpression(init) ||
          !ts.isObjectLiteralExpression(init.expression)
        )
          continue;
        const members = new Map<string, string>();
        for (const prop of init.expression.properties)
          if (
            ts.isPropertyAssignment(prop) &&
            ts.isIdentifier(prop.name) &&
            ts.isStringLiteral(prop.initializer)
          )
            members.set(prop.initializer.text, prop.name.text);
        if (members.size)
          consts.set(decl.name.text, { members, exported: isExported(stmt) });
      }
    }
    if (
      ts.isTypeAliasDeclaration(stmt) &&
      stmt.type.getText(sf).replace(/\s+/g, "") ===
        `(typeof${stmt.name.text})[keyoftypeof${stmt.name.text}]`
    )
      types.add(stmt.name.text);
  }
  return [...consts]
    .filter(([name]) => types.has(name))
    .map(([name, c]) => ({
      name,
      file: relPath(sf.fileName),
      exported: c.exported,
      members: c.members,
    }));
}

const valueKey = (values: Iterable<string>) =>
  [...new Set(values)].sort().join("\u0000");

/** The string-literal value set of a type, or undefined when it has others. */
function literalValues(type: ts.Type | undefined): string[] | undefined {
  if (!type) return undefined;
  const parts = type.isUnion() ? type.types : [type];
  const values: string[] = [];
  for (const t of parts) {
    if (t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)) continue;
    if (!t.isStringLiteral()) return undefined;
    values.push(t.value);
  }
  return values.length ? values : undefined;
}

function ignoredLiteral(node: ts.StringLiteral): boolean {
  const parent = node.parent;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (
    ts.isElementAccessExpression(parent) &&
    parent.argumentExpression === node
  )
    return true;
  for (let p: ts.Node | undefined = parent; p; p = p.parent)
    if (
      ts.isTypeNode(p) ||
      ts.isTemplateExpression(p) ||
      ts.isTaggedTemplateExpression(p) ||
      ts.isImportDeclaration(p) ||
      ts.isExportDeclaration(p)
    )
      return true;
  return false;
}

/** The name of what a union types: a property, parameter, alias or function. */
function unionOwner(node: ts.UnionTypeNode, sf: ts.SourceFile): string {
  for (let p: ts.Node = node.parent; p; p = p.parent) {
    if (
      ts.isPropertySignature(p) ||
      ts.isPropertyDeclaration(p) ||
      ts.isParameter(p) ||
      ts.isTypeAliasDeclaration(p) ||
      ts.isFunctionDeclaration(p) ||
      ts.isMethodDeclaration(p)
    )
      return p.name ? p.name.getText(sf) : "";
    if (ts.isTypeLiteralNode(p) || ts.isInterfaceDeclaration(p)) return "";
  }
  return "";
}

/** True when the union types the discriminant property of a tagged union. */
function isDiscriminant(node: ts.UnionTypeNode): boolean {
  const prop = node.parent;
  if (!ts.isPropertySignature(prop)) return false;
  const shape = prop.parent;
  return ts.isTypeLiteralNode(shape) && ts.isUnionTypeNode(shape.parent);
}

function insideKeyHelper(node: ts.Node): boolean {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent)
    if (
      ts.isTypeReferenceNode(p) &&
      ts.isIdentifier(p.typeName) &&
      KEY_TYPE_HELPERS.has(p.typeName.text)
    )
      return true;
  return false;
}

const EQUALITY = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

const programs: ts.Program[] = [];
for (const project of PROJECTS) {
  const configPath = resolve(root, project);
  if (!existsSync(configPath)) continue;
  const config = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
  );
  if (config)
    programs.push(
      ts.createProgram({
        rootNames: config.fileNames,
        options: config.options,
      }),
    );
}

// Discover every enum once, across all projects.
const enumsByKey = new Map<string, EnumDef[]>();
const seenEnums = new Set<string>();
for (const program of programs)
  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile || !inRepo(sf.fileName)) continue;
    for (const def of enumsIn(sf)) {
      const id = `${def.file}#${def.name}`;
      if (seenEnums.has(id)) continue;
      seenEnums.add(id);
      const key = valueKey(def.members.keys());
      enumsByKey.set(key, [...(enumsByKey.get(key) ?? []), def]);
    }
  }

/** The enum a literal in `file` should name for this value set. */
function enumFor(values: string[], file: string): EnumDef | undefined {
  const candidates = enumsByKey.get(valueKey(values));
  if (!candidates) return undefined;
  return (
    candidates.find((d) => d.file === file) ??
    candidates.find((d) => d.exported)
  );
}

const findings = new Map<string, Finding>();
const checkedFiles = new Set<string>();

for (const program of programs) {
  const checker = program.getTypeChecker();
  for (const sf of program.getSourceFiles()) {
    const file = relPath(sf.fileName);
    if (sf.isDeclarationFile || !inRepo(sf.fileName) || checkedFiles.has(file))
      continue;
    checkedFiles.add(file);
    const exempt = EXEMPT.some((e) => e.pattern.test(file));
    const at = (node: ts.Node) =>
      sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

    const visit = (node: ts.Node): void => {
      // Rule 1: a literal that names an enum value.
      if (!exempt && ts.isStringLiteral(node) && !ignoredLiteral(node)) {
        const parent = node.parent;
        let values = literalValues(checker.getContextualType(node));
        if (
          !values &&
          ts.isBinaryExpression(parent) &&
          EQUALITY.has(parent.operatorToken.kind)
        ) {
          const other = parent.left === node ? parent.right : parent.left;
          values = literalValues(checker.getTypeAtLocation(other));
        }
        if (!values && ts.isCaseClause(parent))
          values = literalValues(
            checker.getTypeAtLocation(parent.parent.parent.expression),
          );
        const def = values ? enumFor(values, file) : undefined;
        const member = def?.members.get(node.text);
        if (def && member)
          findings.set(`${file}:${node.getStart(sf)}`, {
            rule: Rule.Literal,
            file,
            line: at(node),
            start: node.getStart(sf),
            end: node.getEnd(),
            message: `${node.getText(sf)} -> use ${def.name}.${member}`,
            replacement: `${def.name}.${member}`,
            enumName: def.name,
            enumFile: def.file,
          });
      }

      // Rule 2: a new string-literal union.
      if (ts.isUnionTypeNode(node)) {
        const literals = node.types.filter(
          (t) => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal),
        );
        const owner = unionOwner(node, sf);
        const allowed =
          literals.length < 2 ||
          isDiscriminant(node) ||
          insideKeyHelper(node) ||
          ALLOWED_UNIONS.some((a) => a.file === file && a.owner === owner);
        if (!allowed)
          findings.set(`${file}:${node.getStart(sf)}:union`, {
            rule: Rule.Union,
            file,
            line: at(node),
            start: node.getStart(sf),
            end: node.getEnd(),
            message: `string-literal union${owner ? ` on \`${owner}\`` : ""} (${literals
              .map((t) => t.getText(sf))
              .join(" | ")}) -> declare an enum or a constant list`,
          });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
}

const list = [...findings.values()].sort((a, b) =>
  a.file < b.file ? -1 : a.file > b.file ? 1 : a.start - b.start,
);
if (asJson) {
  console.log(JSON.stringify(list, null, 2));
  process.exit(list.length ? 1 : 0);
}
if (list.length === 0) {
  console.log(`check-enums: ok (${seenEnums.size} enums checked)`);
  process.exit(0);
}
for (const f of list) console.error(`${f.file}:${f.line}: ${f.message}`);
const literals = list.filter((f) => f.rule === Rule.Literal).length;
console.error(
  `\ncheck-enums: ${literals} literal(s) where an enum exists, ${list.length - literals} string-literal union(s).`,
);
process.exit(1);
