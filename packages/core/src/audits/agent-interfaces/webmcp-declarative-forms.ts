import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext } from "../../check-context";

// Re-graded A -> B on 2026-08-24. Chrome's declarative-API page is live and
// states that the browser reads an annotated form as a tool, but it carries an
// origin-trial badge and says "WebMCP is under active discussion and subject to
// change in the future". policy.md reserves grade A for a ratified standard or
// documented shipped behaviour; an origin trial is a draft standard with
// meaningful adoption, which is grade B.

/**
 * The Declarative WebMCP attributes, exactly as the W3C Web Machine Learning CG
 * explainer and Chrome's own documentation spell them (all lower-case, no
 * dashes, no `data-` prefix):
 *
 *   - `toolname`             on <form> — registers the tool. Without it nothing
 *                            is registered, which is what WPT's
 *                            getTools-declarative-schema.https.html asserts.
 *   - `tooldescription`      on <form> — what the agent selects the tool on.
 *   - `toolparamdescription` on form-associated controls — per-property
 *                            descriptions in the synthesized JSON Schema.
 *   - `toolautosubmit`       on <form> — submit without a user gesture.
 */
const TOOL_NAME_ATTR = "toolname";
const TOOL_DESCRIPTION_ATTR = "tooldescription";
const TOOL_PARAM_DESCRIPTION_ATTR = "toolparamdescription";

interface FormSurvey {
  total: number;
  /** Forms with a non-empty toolname — the only ones a browser registers. */
  named: string[];
  /** Forms carrying a description or param descriptions but no toolname. */
  nameless: number;
  /** Named forms missing a tooldescription. */
  undescribed: string[];
  /** Named forms with at least one toolparamdescription on a control. */
  withParamDescriptions: number;
  firstPageUrl: string;
}

function survey(ctx: CheckContext): FormSurvey {
  const result: FormSurvey = {
    total: 0,
    named: [],
    nameless: 0,
    undescribed: [],
    withParamDescriptions: 0,
    firstPageUrl: "",
  };

  for (const page of ctx.pages) {
    page.$("form").each((_, el) => {
      result.total++;
      const $form = page.$(el);
      const toolname = ($form.attr(TOOL_NAME_ATTR) ?? "").trim();
      const tooldescription = ($form.attr(TOOL_DESCRIPTION_ATTR) ?? "").trim();

      if (!toolname) {
        // A description without a name registers nothing. The pre-rewrite
        // audit counted these as WebMCP forms, so a single description-only
        // form produced a full pass with an empty tool list.
        if (
          tooldescription ||
          $form.find(`[${TOOL_PARAM_DESCRIPTION_ATTR}]`).length > 0
        ) {
          result.nameless++;
        }
        return;
      }

      result.named.push(toolname);
      if (!tooldescription) result.undescribed.push(toolname);
      if ($form.find(`[${TOOL_PARAM_DESCRIPTION_ATTR}]`).length > 0) {
        result.withParamDescriptions++;
      }
      if (!result.firstPageUrl) result.firstPageUrl = page.url;
    });
  }

  return result;
}

const EXPECTED = `Each form exposed to agents carries a ${TOOL_NAME_ATTR} and a ${TOOL_DESCRIPTION_ATTR}`;

const SAMPLE = `<!-- Declarative WebMCP: the browser synthesizes a JSON Schema from the
     form's controls and registers it as an agent-callable tool. -->
<form toolname="search_products"
      tooldescription="Search the product catalog by keyword"
      action="/search" method="GET">
  <input type="text" name="q"
         toolparamdescription="Keywords to search the catalog for" />
  <button type="submit">Search</button>
</form>

<!-- toolautosubmit lets the agent submit without a user gesture. Use it only
     for read-only tools; leave it off anything that changes state. -->
<form toolname="add_to_cart"
      tooldescription="Add a product to the shopping cart"
      action="/cart/add" method="POST">
  <input type="hidden" name="product_id" />
  <input type="number" name="quantity" value="1" min="1"
         toolparamdescription="How many units to add" />
  <button type="submit">Add to Cart</button>
</form>`;

export class WebmcpDeclarativeFormsAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agent-interfaces/webmcp-declarative-forms",
    category: "agent-interfaces",
    title: "WebMCP declarative form tools",
    failureTitle: "WebMCP declarative form tools",
    description:
      "WebMCP's Declarative API turns an HTML <form> into an agent-callable tool: add toolname and tooldescription and the browser synthesizes a JSON Schema from the form's controls, which an in-browser agent can discover and invoke without any JavaScript. toolname is what registers the tool — a description on its own registers nothing.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("B", "scored"),
    evidenceGrade: "B",
    tier: "scored",
    dossier:
      "docs/evidence/audits/agent-interfaces/webmcp-declarative-forms.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    // Softened from 'high': the feature is Baseline "limited" (Chrome 149 /
    // Edge 150 origin trials, Brave Leo experimental) and Apple's WebKit
    // standards position is "oppose", so this is worth doing, not urgent.
    defaultPriority: "medium",
    guidance: {
      impact:
        "Without the declarative attributes, an agent in a supporting browser has no structured tool for your form and falls back to heuristics or vision to work out which control is which — slower, and wrong more often on anything past a single text input.",
      fix: "Add toolname (a short snake_case verb phrase) and tooldescription to each form you want agents to be able to call, and put toolparamdescription on the individual controls so the synthesized JSON Schema explains each property. Add toolautosubmit only to read-only tools.",
      code: SAMPLE,
      effort: "easy",
      docsUrl: "https://developer.chrome.com/docs/ai/webmcp/declarative-api",
      tags: ["webmcp", "declarative", "forms", "agent-protocol"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const forms = survey(ctx);

    // A documentation site or a blog has nothing to annotate. Charging it a
    // score for the forms it does not have measures the site's genre, not its
    // agent-readiness.
    if (forms.total === 0) {
      return this.notApplicable(
        "No forms on the scanned pages, so there is nothing to expose as a declarative WebMCP tool.",
        EXPECTED,
        "0 forms on scanned pages",
      );
    }

    const paramNote =
      forms.named.length > 0
        ? `; ${forms.withParamDescriptions}/${forms.named.length} with ${TOOL_PARAM_DESCRIPTION_ATTR}`
        : "";
    const found = `${forms.named.length}/${forms.total} forms registered as tools${paramNote}`;
    const namelessNote =
      forms.nameless > 0
        ? ` ${forms.nameless} form(s) carry WebMCP markup without a ${TOOL_NAME_ATTR}, which registers no tool at all.`
        : "";

    if (forms.named.length === 0) {
      return this.fail(
        `Found ${forms.total} form(s) but none carry a ${TOOL_NAME_ATTR}, so no form is exposed as a WebMCP tool.${namelessNote}`,
        EXPECTED,
        found,
        "medium",
      );
    }

    const toolsLabel = ` (tools: ${forms.named.join(", ")})`;

    if (forms.named.length < forms.total) {
      return this.warn(
        `${forms.named.length}/${forms.total} form(s) are exposed as WebMCP tools${toolsLabel}.${namelessNote}`,
        EXPECTED,
        found,
        "medium",
        forms.firstPageUrl,
      );
    }

    // Registered but unselectable: an agent picks a tool by its description.
    if (forms.undescribed.length > 0) {
      return this.warn(
        `All ${forms.total} form(s) are registered as WebMCP tools, but ${forms.undescribed.join(", ")} ${forms.undescribed.length === 1 ? "has" : "have"} no ${TOOL_DESCRIPTION_ATTR}, so an agent has nothing to select the tool on.`,
        EXPECTED,
        found,
        "medium",
        forms.firstPageUrl,
      );
    }

    return this.pass(
      `All ${forms.total} form(s) are exposed as WebMCP tools${toolsLabel}.`,
      EXPECTED,
      found,
      forms.firstPageUrl,
    );
  }
}
