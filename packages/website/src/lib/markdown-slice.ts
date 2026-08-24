import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** The body under one `## ` heading, up to the next one. */
export function sliceSection(markdown: string, heading: string): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trim() === heading.trim());
  if (start === -1) throw new Error(`Heading not found: ${heading}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

/** One documentation page, and the markdown it is rendered from. */
export interface DocSection {
  /** The last segment of its route — see `docPath` in `routes.ts`. */
  slug: string;
  /** Its label in the sidebar, and its `<title>` when the source has no `# `. */
  title: string;
  /** The source file, relative to the repository root. */
  file: string;
  /** The `## ` heading to slice out, when the page is one section of a file. */
  heading?: string;
}

/**
 * Where each docs page gets its prose.
 *
 * Reuse first: nothing here is copied into this package. Six pages are sections
 * of the README, rendered in place; five are whole files under `docs/`. A
 * renamed heading empties a page silently, so `markdown-slice.test.ts` pins
 * every one of them against the file on disk.
 */
export const DOC_SECTIONS: readonly DocSection[] = [
  { slug: 'quickstart', title: 'Quickstart', file: 'README.md', heading: '## ⚡ Quickstart' },
  { slug: 'architecture', title: 'Packages & architecture', file: 'README.md', heading: '## 📦 Packages & Architecture' },
  { slug: 'sdk', title: 'Node.js / TypeScript SDK', file: 'README.md', heading: '## 💻 Programmatic Node.js / TypeScript SDK' },
  { slug: 'mcp', title: 'MCP server', file: 'README.md', heading: '## 🤖 Model Context Protocol (MCP) Server' },
  { slug: 'ci', title: 'GitHub Actions CI', file: 'README.md', heading: '## 🛡️ GitHub Actions CI' },
  { slug: 'share', title: 'Share your score', file: 'README.md', heading: '## 📣 Share Your Score' },
  { slug: 'badge', title: 'Badge', file: 'docs/BADGE.md' },
  { slug: 'benchmark', title: 'Benchmark', file: 'docs/BENCHMARK.md' },
  { slug: 'scoring', title: 'Scoring', file: 'docs/SCORING.md' },
  { slug: 'cli', title: 'CLI reference', file: 'docs/CLI.md' },
  { slug: 'config', title: 'Configuration', file: 'docs/CONFIG.md' },
];

/**
 * The repository directory a section's links are written from — `''` for the
 * README at the root, `docs` for the files under it. Relative links inside the
 * prose resolve against this, not against the route the page is published at.
 */
export function docSourceDir(section: DocSection): string {
  const cut = section.file.lastIndexOf('/');
  return cut === -1 ? '' : section.file.slice(0, cut);
}

/**
 * The repository root, found by walking up from the working directory.
 *
 * Not from `import.meta.url`: a page module is bundled before it runs, so its
 * module URL points into the build output rather than at `src/`. The working
 * directory is `packages/website` under `astro build` and the repository root
 * under `vitest`, and the walk covers both.
 */
function repoRoot(): string {
  let dir = process.cwd();
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`No pnpm-workspace.yaml above ${process.cwd()}`);
    dir = parent;
  }
  return dir;
}

/**
 * The markdown one docs page renders: a whole file, or one section of one.
 *
 * The file is read where it lives and never copied into this package, so the
 * page and the repository cannot drift apart.
 */
export function readDocSource(section: DocSection): string {
  const source = readFileSync(join(repoRoot(), section.file), 'utf8');
  if (!section.heading) return source;
  // The README separates its sections with a `---` rule. Sliced off with the
  // section it belongs to neither, and renders as a stray divider directly
  // above the one `PrevNext` already draws.
  return sliceSection(source, section.heading).trimEnd().replace(/\n-{3,}$/, '');
}
