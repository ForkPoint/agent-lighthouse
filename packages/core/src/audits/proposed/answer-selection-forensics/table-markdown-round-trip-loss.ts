import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Table Markdown Round-Trip Loss".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/answer-selection-forensics/table-markdown-round-trip-loss.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static fetch. Per table in main content: 1) DOM-level flags — hasCaption, hasTh, thScopeCoverage
// (fraction of th with a valid scope when the table has both row and column headers), spannedHeader
// (any th with colspan or rowspan > 1), nestedTable, blockContentInCell (p/ul/ol/table/dl inside td
// or th), raggedRow (row cell count, expanded for spans, differs from header column count),
// headerlessNumeric (zero th and >= 2 numeric-majority columns), unitsStranded (currency or unit
// token present in <caption> or a footnote but absent from every header cell and every cell). 2)
// Round-trip: serialize with a GFM table serializer, re-parse with a GFM parser, rebuild the grid,
// and diff against the expanded source grid. Report lostCells, shiftedCells, and mergedCells with
// row/column coordinates and their text. 3) Fail the table on any nonzero round-trip loss, or on
// headerlessNumeric, or on unitsStranded. 4) Score = tables with zero loss / total main-content
// tables. 5) Suggested fix per finding: flatten spanned headers into repeated explicit th, move
// units into header cells, pull block content out of cells.
export class TableMarkdownRoundTripLossAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/answer-selection-forensics/table-markdown-round-trip-loss',
    category: 'answer-selection-forensics',
    title: "Table Markdown Round-Trip Loss",
    failureTitle: "Table Markdown Round-Trip Loss",
    description: "Converts every main-content table to GFM markdown — the exact representation answer-engine readers emit — re-parses it, and diffs cell-for-cell against the source DOM. Any cell lost, merged, or de-associated is reported by coordinate. Layered on top of the WHATWG header-association check (th, scope, headers) so the finding distinguishes 'screen readers can't parse this' from 'the LLM will read the wrong number'.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Production ingestion pipelines convert HTML to markdown before embedding (S10 Jina Reader, S11 Firecrawl). GFM tables cannot represent colspan/rowspan, cannot nest, cannot hold block content ('Block-level elements cannot be inserted in a table'), and silently discard excess cells ('the excess is ignored') (S8). So a spanned header, a nested table, or a ragged row does not degrade gracefully — it produces a well-formed markdown table containing values shifted into the wrong columns, which the model then reads as fact. Meanwhile WHATWG leaves header association undefined for tables built purely from td (S7), so headerless numeric tables have no machine-recoverable meaning at all. Falsifiable: round-trip the table and compare; the loss is deterministic and reproducible, not a judgement.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/answer-selection-forensics/table-markdown-round-trip-loss.md',
      tags: ['proposed', 'answer-selection-forensics'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/answer-selection-forensics/table-markdown-round-trip-loss.md',
      'TODO stub',
    );
  }
}
