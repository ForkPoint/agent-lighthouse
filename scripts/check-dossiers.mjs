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
 * It also runs the reverse check: every `.md` under `docs/evidence/audits/`
 * (README aside) must be the dossier of a registered audit. A file left behind
 * there after its audit was removed or folded away is an orphan — the record of
 * a removed audit belongs under `docs/evidence/sunset/`, and of a merged-away
 * signal under `docs/evidence/merged/`. Without this direction the folder
 * silently accumulates dossiers for checks that no longer ship.
 *
 * Reads the registry from the *built* core bundle, so `pnpm build` (or at least
 * `pnpm --filter @forkpoint/agent-lighthouse-core build`) must run first — which
 * is exactly what CI already does before this step.
 *
 * Exits 0 when every audit passes, 1 with a per-violation list otherwise.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
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

/**
 * Every source id the registry defines.
 *
 * A dossier stores `sources:` as ids and nothing else, so an id that resolves
 * to no record would publish a page with a missing citation. Caught here rather
 * than in the website build, because the registry and the dossiers are both
 * repository data and this is the script that proves they agree.
 */
const registryIds = new Set(
  JSON.parse(readFileSync(resolve(repoRoot, 'docs/evidence/sources.json'), 'utf8')).sources.map(
    (source) => source.id,
  ),
);

/** The `sources:` ids of one dossier, read off the raw frontmatter block. */
function sourceIds(text) {
  const block = /^sources:\n((?:\s+- .*\n)+)/m.exec(text)?.[1];
  if (!block) return [];
  return block
    .trimEnd()
    .split('\n')
    .map((line) => line.replace(/^\s*- /, '').trim());
}

/** @type {string[]} */
const violations = [];
let checked = 0;
/** Repo-relative, POSIX-separated dossier paths claimed by a registered audit. */
const claimed = new Set();

for (const registrations of Object.values(defaultConfig.audits)) {
  for (const { meta } of registrations) {
    checked += 1;
    const id = meta.id;

    if (!meta.dossier) {
      violations.push(`${id}: meta.dossier is not set`);
      continue;
    }

    const dossierPath = resolve(repoRoot, meta.dossier);
    claimed.add(relative(repoRoot, dossierPath).split(sep).join('/'));
    if (!existsSync(dossierPath)) {
      violations.push(`${id}: dossier file not found — ${meta.dossier}`);
      continue;
    }

    const front = parseFrontmatter(readFileSync(dossierPath, 'utf8'));
    if (!front) {
      violations.push(`${id}: dossier has no YAML frontmatter — ${meta.dossier}`);
      continue;
    }

    const unknown = sourceIds(readFileSync(dossierPath, 'utf8')).filter(
      (sourceId) => !registryIds.has(sourceId),
    );
    if (unknown.length > 0) {
      violations.push(
        `${id}: sources: names ${unknown.length} id(s) the registry does not define — ` +
          `${unknown.join(', ')} (${meta.dossier})`,
      );
    }

    // The research's own recommendation, and the tier that actually shipped.
    // They are allowed to differ — the contradiction sweep overrode eight of
    // them on purpose — but a difference has to be written down, or the next
    // reader cannot tell a decision from a drift.
    const recommended = front.recommended_tier;
    const tier = meta.tier ?? 'scored';
    if (recommended && recommended !== tier && !front.tier_rationale) {
      violations.push(
        `${id}: ships tier "${tier}" but its dossier recommends "${recommended}" ` +
          `with no tier_rationale to say why (${meta.dossier})`,
      );
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

// Reverse direction: nothing may sit in the audit-dossier folder without a
// registered audit pointing at it.
const dossierRoot = 'docs/evidence/audits';

/**
 * Collect every `.md` under a directory, repo-relative and POSIX-separated.
 *
 * @param {string} relDir directory to walk, relative to the repo root
 * @returns {string[]} repo-relative paths
 */
function collectMarkdown(relDir) {
  /** @type {string[]} */
  const found = [];
  for (const entry of readdirSync(resolve(repoRoot, relDir), { withFileTypes: true })) {
    const child = `${relDir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...collectMarkdown(child));
    else if (entry.name.endsWith('.md')) found.push(child);
  }
  return found;
}

const onDisk = collectMarkdown(dossierRoot);
// The folder's own index is not an audit dossier.
const orphans = onDisk.filter((p) => p !== `${dossierRoot}/README.md` && !claimed.has(p));
for (const orphan of orphans) {
  violations.push(
    `orphan dossier — no registered audit claims ${orphan} ` +
      '(move it to docs/evidence/sunset/ if the audit was removed, ' +
      'or docs/evidence/merged/ if its signal folded into another audit)',
  );
}

if (violations.length > 0) {
  console.error(`check-dossiers: ${violations.length} violation(s) across ${checked} audits:\n`);
  for (const v of violations) console.error(`  ✗ ${v}`);
  console.error('');
  process.exit(1);
}

console.log(
  `check-dossiers: ${checked} audits OK (dossier exists, grade + slug match); ` +
    `${onDisk.length - 1} dossiers under ${dossierRoot}/, no orphans.`,
);
