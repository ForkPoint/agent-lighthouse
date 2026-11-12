import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

const INDEXABLE_ID = /^[A-Za-z0-9_.:-]+$/;

/**
 * Resolve all explicit labels in document order for one fixed-DOM pass.
 * Labels may sit outside their form. Callers choose whether to read the first
 * label or their combined text. No result survives a later parsing pass.
 */
export function createExplicitLabelLookup(
  $: CheerioAPI,
): (id: string | undefined) => Cheerio<Element> | undefined {
  let byId: Map<string, Element[]> | undefined;
  return (id: string | undefined) => {
    if (!id) return undefined;
    // Keep the old quoted selector for unusual values and escape edge cases.
    if (!INDEXABLE_ID.test(id)) {
      const escaped = id.replace(/(["\\])/g, "\\$1");
      const labels = $(`label[for="${escaped}"]`);
      return labels.length > 0 ? labels : undefined;
    }
    if (!byId) {
      byId = new Map();
      $("label[for]").each((_i, label) => {
        const key = $(label).attr("for")!;
        const group = byId!.get(key);
        if (group) group.push(label);
        else byId!.set(key, [label]);
      });
    }
    const labels = byId.get(id);
    return labels ? $(labels) : undefined;
  };
}
