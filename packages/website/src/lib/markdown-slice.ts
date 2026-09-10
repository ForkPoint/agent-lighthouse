import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * A fenced code block's opening or closing run — three or more backticks or
 * tildes, indented by at most three spaces, which is what makes it a fence
 * rather than an indented code block.
 */
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * The body under one `## ` heading, up to the next one.
 *
 * Both the heading and the boundary are matched outside fenced code blocks
 * only. A `## ` line inside a fence is a shell or YAML comment, or a nested
 * markdown example — never the start of a section — and stopping at one would
 * silently truncate the page: the heading is still found and the slice is still
 * non-empty, so nothing downstream can tell that the rest of the body is gone.
 */
export function sliceSection(markdown: string, heading: string): string {
  const wanted = heading.trim();
  const lines = markdown.split("\n");

  // The fence currently open, as the character it is built from and the length
  // it must be closed by: a fence closes only on a run of the same character,
  // at least as long, with nothing else on the line.
  let fence: { char: string; length: number } | null = null;
  let start = -1;
  let end = -1;

  for (const [index, line] of lines.entries()) {
    const run = FENCE.exec(line)?.[1];

    if (fence) {
      const closes =
        run !== undefined &&
        run[0] === fence.char &&
        run.length >= fence.length &&
        line.slice(line.indexOf(run) + run.length).trim() === "";
      if (closes) fence = null;
      continue;
    }

    if (run !== undefined) {
      fence = { char: run[0]!, length: run.length };
      continue;
    }

    if (start === -1) {
      if (line.trim() === wanted) start = index;
      continue;
    }

    if (line.startsWith("## ")) {
      end = index;
      break;
    }
  }

  if (start === -1) throw new Error(`Heading not found: ${heading}`);
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n");
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
  /** Keep links from the repository reference pointing to its public guide. */
  referenceFile?: string;
  /** Explain when to use a technical reference before presenting its options. */
  summary?: string;
}

/**
 * Where each docs page gets its prose.
 *
 * Public guides live in website content. Detailed command and config references
 * still render from repository docs. Reference aliases preserve incoming links.
 */
export const DOC_SECTIONS: readonly DocSection[] = [
  {
    slug: "quickstart",
    title: "Quickstart",
    file: "packages/website/src/content/quickstart.md",
  },
  {
    slug: "architecture",
    title: "Packages & architecture",
    file: "packages/website/src/content/packages.md",
  },
  {
    slug: "sdk",
    title: "Node.js / TypeScript SDK",
    file: "packages/website/src/content/sdk.md",
  },
  {
    slug: "mcp",
    title: "MCP server",
    file: "packages/website/src/content/mcp.md",
  },
  {
    slug: "ci",
    title: "GitHub Actions CI",
    file: "packages/website/src/content/ci.md",
  },
  {
    slug: "share",
    title: "Share a scan report",
    file: "packages/website/src/content/share.md",
  },
  {
    slug: "badge",
    title: "Add a score badge",
    file: "packages/website/src/content/badge.md",
    referenceFile: "docs/badge.md",
  },
  {
    slug: "benchmark",
    title: "Compare scans",
    file: "packages/website/src/content/benchmark.md",
    referenceFile: "docs/benchmark.md",
  },
  {
    slug: "scoring",
    title: "Understand your score",
    file: "packages/website/src/content/scoring.md",
    referenceFile: "docs/scoring.md",
  },
  {
    slug: "audit-architecture",
    title: "How a scan works",
    file: "packages/website/src/content/how-scans-work.md",
  },
  {
    slug: "cli",
    title: "CLI reference",
    file: "docs/cli.md",
    summary:
      "Use command-line options to choose what to scan, where to save reports, and when a run should fail a score threshold. Start with the basic command below. Look up an option only when you need it.",
  },
  {
    slug: "config",
    title: "Configuration",
    file: "docs/config.md",
    summary:
      "Save repeatable scan settings in a JSON file. Command-line options usually override the file. Some settings work only as command-line flags; the tables below call out those limits.",
  },
];

/**
 * The repository directory a section's links are written from — `''` for the
 * README at the root, `docs` for the files under it. Relative links inside the
 * prose resolve against this, not against the route the page is published at.
 */
export function docSourceDir(section: DocSection): string {
  const cut = section.file.lastIndexOf("/");
  return cut === -1 ? "" : section.file.slice(0, cut);
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
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const parent = dirname(dir);
    if (parent === dir)
      throw new Error(`No pnpm-workspace.yaml above ${process.cwd()}`);
    dir = parent;
  }
  return dir;
}

/**
 * An absolute path to a file in the repository, from its root-relative path.
 *
 * Exported because the docs pages are no longer the only thing reading out of
 * the repository: the policy page and the source registry do too, and all of
 * them need the same walk to find the root.
 */
export function repoPath(file: string): string {
  return join(repoRoot(), file);
}

/**
 * The markdown one docs page renders: a whole file, or one section of one.
 *
 * The file is read where it lives and never copied into this package, so the
 * page and the repository cannot drift apart.
 */
export function readDocSource(section: DocSection): string {
  const source = readFileSync(repoPath(section.file), "utf8");
  if (!section.heading) return source;
  // The README separates its sections with a `---` rule. Sliced off with the
  // section it belongs to neither, and renders as a stray divider directly
  // above the one `PrevNext` already draws.
  return sliceSection(source, section.heading)
    .trimEnd()
    .replace(/\n-{3,}$/, "");
}
