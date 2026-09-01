import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const auditsDir = path.resolve(__dirname, '../packages/core/src/audits');

function findAuditSources(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findAuditSources(fullPath));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      entry.name !== 'index.ts'
    ) {
      out.push(fullPath);
    }
  }
  return out;
}

const HTTP_CLIENT_MODULES = new Set([
  'undici',
  'axios',
  'got',
  'node-fetch',
  'node:http',
  'node:https',
  'http',
  'https',
]);

let totalViolations = 0;
const sources = findAuditSources(auditsDir);

for (const filePath of sources) {
  const code = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
  const relPath = path.relative(auditsDir, filePath);
  const violations = [];

  function visit(node) {
    // 1. Check for imports of fetcher or HTTP clients (executable value imports only)
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const isTypeOnly = node.importClause?.isTypeOnly;
      if (!isTypeOnly) {
        const mod = node.moduleSpecifier.text;
        if (mod.includes('fetcher') || HTTP_CLIENT_MODULES.has(mod)) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          violations.push(`Line ${line}: Direct HTTP/fetcher import '${mod}' in audit source`);
        }
      }
    }

    // 2. Check for property access ctx.fetch or obj.fetch
    if (ts.isPropertyAccessExpression(node)) {
      if (node.name.text === 'fetch') {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        violations.push(`Line ${line}: Accessing .fetch property on context`);
      }
    }

    // 3. Check for binding element destructuring fetch (e.g. const { fetch } = ctx)
    if (ts.isBindingElement(node) && node.name && ts.isIdentifier(node.name) && node.name.text === 'fetch') {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      violations.push(`Line ${line}: Destructuring 'fetch' from context`);
    }

    // 4. Check for bare fetch() call position
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'fetch') {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      violations.push(`Line ${line}: Direct fetch() call`);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (violations.length > 0) {
    console.error(`\n❌ Violation(s) in ${relPath}:`);
    for (const v of violations) {
      console.error(`   - ${v}`);
    }
    totalViolations += violations.length;
  }
}

if (totalViolations > 0) {
  console.error(`\ncheck-audit-boundaries: FAILED with ${totalViolations} boundary violation(s). Production audits must not issue network requests directly.`);
  process.exit(1);
} else {
  console.log(`check-audit-boundaries: OK — all ${sources.length} production audit sources clear of direct network calls.`);
}
