import { DOC_SECTIONS } from "./markdown-slice";
import { docPath, withBase } from "./routes";

/** One entry of the documentation sidebar — the shape `SidebarNav` takes. */
export interface DocNavEntry {
  label: string;
  href: string;
  group?: string;
}

/**
 * Shared reading order: first scan, results and proof, sharing, then developer
 * reference. Documentation pages also use this order for previous/next links.
 */
export function documentationNav(): DocNavEntry[] {
  const doc = (slug: string, group: string): DocNavEntry => {
    const section = DOC_SECTIONS.find((section) => section.slug === slug);
    if (!section) throw new Error(`Unknown documentation page: ${slug}`);
    return { label: section.title, href: docPath(slug), group };
  };
  return [
    doc("quickstart", "Get started"),
    doc("audit-architecture", "Get started"),
    doc("scoring", "Understand your results"),
    {
      label: "Proof behind the checks",
      href: withBase("policy/"),
      group: "Understand your results",
    },
    {
      label: "Trusted sources",
      href: withBase("sources/"),
      group: "Understand your results",
    },
    doc("share", "Share your result"),
    doc("badge", "Share your result"),
    ...["cli", "config", "sdk", "mcp", "ci", "benchmark", "architecture"].map(
      (slug) => doc(slug, "Developer reference"),
    ),
  ];
}
