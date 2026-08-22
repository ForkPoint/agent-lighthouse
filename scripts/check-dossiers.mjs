#!/usr/bin/env node
/**
 * check-dossiers — CI guard for audit ↔ evidence-dossier linkage.
 *
 * For every audit registered in the default scan config, asserts that:
 *   (a) the file named by `meta.dossier` exists on disk;
 *   (b) the dossier's frontmatter `evidence_grade` equals `meta.evidenceGrade`;
 *   (c) the dossier's frontmatter `slug` matches the audit's slug (the segment
 *       after the `/` in `meta.id`).
 *
 * Reads the registry from the *built* core bundle, so `pnpm build` (or at least
 * `pnpm --filter @forkpoint/agent-lighthouse-core build`) must run first — which
 * is exactly what CI already does before this step.
 *
 * Exits 0 when every audit passes, 1 with a per-violation list otherwise.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coreDist = resolve(repoRoot, 'packages/core/dist/index.mjs');

if (!existsSync(coreDist)) {
  console.error(
    `check-dossiers: built core not found at ${coreDist}\n` +
      'Run `pnpm --filter @forkpoint/agent-lighthouse-core build` first.',
  );
  process.exit(1);
}

const { defaultConfig } = await import(pathToFileURL(coreDist).href);

/**
 * Extract top-level scalar keys from a Markdown YAML frontmatter block.
 * Deliberately minimal: dossier frontmatter is flat `key: value` pairs, so a
 * full YAML parser would only add a dependency for no gain.
 *
 * @param {string} source raw file contents
 * @returns {Record<string, string> | null} parsed keys, or null when the file has no frontmatter
 */
function parseFrontmatter(source) {
  const text = source.replace(/^﻿/, '');
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;

  const body = text.slice(text.indexOf('\n') + 1, end + 1);
  /** @type {Record<string, string>} */
  const out = {};
  for (const rawLine of body.split('\n')) {
    // Skip blank lines, comments, and nested/list entries.
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) continue;
    if (rawLine.startsWith(' ') || rawLine.startsWith('\t') || rawLine.startsWith('-')) continue;
    const sep = rawLine.indexOf(':');
    if (sep === -1) continue;
    const key = rawLine.slice(0, sep).trim();
    let value = rawLine.slice(sep + 1).trim();
    // Strip a trailing inline comment only when the value is unquoted.
    if (!/^["']/.test(value)) value = value.replace(/\s+#.*$/, '').trim();
    value = value.replace(/^["'](.*)["']$/, '$1');
    out[key] = value;
  }
  return out;
}

/** @type {string[]} */
const violations = [];
let checked = 0;

for (const registrations of Object.values(defaultConfig.audits)) {
  for (const { meta } of registrations) {
    checked += 1;
    const id = meta.id;

    if (!meta.dossier) {
      violations.push(`${id}: meta.dossier is not set`);
      continue;
    }

    const dossierPath = resolve(repoRoot, meta.dossier);
    if (!existsSync(dossierPath)) {
      violations.push(`${id}: dossier file not found — ${meta.dossier}`);
      continue;
    }

    const front = parseFrontmatter(readFileSync(dossierPath, 'utf8'));
    if (!front) {
      violations.push(`${id}: dossier has no YAML frontmatter — ${meta.dossier}`);
      continue;
    }

    if (front.evidence_grade !== meta.evidenceGrade) {
      violations.push(
        `${id}: evidence_grade mismatch — dossier "${front.evidence_grade ?? '(missing)'}" ` +
          `vs meta "${meta.evidenceGrade}" (${meta.dossier})`,
      );
    }

    const expectedSlug = id.includes('/') ? id.slice(id.indexOf('/') + 1) : id;
    if (front.slug !== expectedSlug) {
      violations.push(
        `${id}: slug mismatch — dossier "${front.slug ?? '(missing)'}" ` +
          `vs audit slug "${expectedSlug}" (${meta.dossier})`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error(`check-dossiers: ${violations.length} violation(s) across ${checked} audits:\n`);
  for (const v of violations) console.error(`  ✗ ${v}`);
  console.error('');
  process.exit(1);
}

console.log(`check-dossiers: ${checked} audits OK (dossier exists, grade + slug match).`);
