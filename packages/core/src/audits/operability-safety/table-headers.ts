/**
 * 7.17 Data tables have header associations (`operability-safety/table-headers`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 */
import { base, defineA11yAudit, graded } from "./_shared";

export const TableHeadersAudit = defineA11yAudit({
  rules: [
    "td-has-header",
    "th-has-data-cells",
    "td-headers-attr",
    "scope-attr-valid",
  ],
  meta: {
    ...base,
    ...graded("B", "table-headers"),
    id: "operability-safety/table-headers",
    title: "Data tables have header associations",
    failureTitle: "Data table cells lack header associations",
    description:
      "Agents extracting tabular data rely on header↔cell associations (th scope / headers attr) to know what each value means. Missing associations make tables ambiguous.",
    defaultPriority: "medium",
    guidance: {
      impact:
        "Without header associations, an agent reading a price/spec table cannot reliably pair each value with its column/row meaning.",
      fix: 'Use <th scope="col"|"row"> headers (or headers/id) so every data cell maps to its header.',
      code: '<table><tr><th scope="col">Size</th><th scope="col">Price</th></tr><tr><td>M</td><td>$29</td></tr></table>',
      effort: "moderate",
      tags: ["tables", "extraction", "agent"],
    },
  },
});
