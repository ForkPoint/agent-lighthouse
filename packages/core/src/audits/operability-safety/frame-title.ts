/**
 * 7.19 Frames are titled (`operability-safety/frame-title`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 */
import { base, defineA11yAudit, graded } from "./_shared";
import { CheckPriority, EvidenceGrade, FixEffort } from "#core/types";

export const FrameTitleAudit = defineA11yAudit({
  rules: ["frame-title", "frame-title-unique"],
  meta: {
    ...base,
    ...graded(EvidenceGrade.C, "frame-title"),
    id: "operability-safety/frame-title",
    title: "Frames are titled",
    failureTitle: "Untitled or duplicate-titled frames",
    description:
      "Agents need a title to understand what each iframe contains. Untitled or duplicate-titled frames are opaque embedded contexts.",
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "Without a title an agent cannot tell what an iframe holds (checkout widget? map? video?), so it may skip or misuse it.",
      fix: "Give every <iframe> a unique, descriptive title attribute.",
      code: '<iframe title="Checkout payment form" src="..."></iframe>',
      effort: FixEffort.Easy,
      tags: ["frames", "agent"],
    },
  },
});
