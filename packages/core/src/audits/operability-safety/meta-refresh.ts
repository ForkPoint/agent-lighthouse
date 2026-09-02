/**
 * 7.20 No auto-refresh / time-based redirect (`operability-safety/meta-refresh`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 */
import { base, defineA11yAudit, graded } from "./_shared";

export const MetaRefreshAudit = defineA11yAudit({
  rules: ["meta-refresh"],
  meta: {
    ...base,
    ...graded("A", "meta-refresh"),
    id: "operability-safety/meta-refresh",
    title: "No time-based auto-refresh/redirect",
    failureTitle: "Time-based meta refresh present",
    description:
      'A <meta http-equiv="refresh"> that reloads/redirects after a delay disrupts an agent mid-read and can trap it in unexpected navigation.',
    defaultPriority: "medium",
    guidance: {
      impact:
        "Auto-refresh changes the page out from under an agent that is reading or acting, corrupting its state and any in-progress task.",
      fix: "Remove time-based meta refresh; use proper server redirects (3xx) for instant redirects.",
      code: '<!-- BAD --> <meta http-equiv="refresh" content="5;url=/next">',
      effort: "easy",
      tags: ["navigation", "agent"],
    },
  },
});
