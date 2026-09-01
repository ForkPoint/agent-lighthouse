/**
 * The 26 supported accessibility rules and the rule runner.
 *
 * Per rule we: select candidate elements, filter by the rule `matches` predicate
 * and (unless `excludeHidden:false`) by screen-reader visibility, evaluate the
 * all/any/none check composition per node, apply any `after` reducer, then
 * collapse to a single rule-level status with failing-node targets.
 */
import { ariaRoles } from "./standards";
import {
  VNode,
  toVNode,
  parseTabindex,
  registerMatchers,
  type AnyNode,
} from "./core";
import {
  getExplicitRole,
  getImplicitRole,
  getRole,
  requiredOwned,
  requiredContext,
  isAccessibleRef,
  isComboboxPopup,
} from "./aria";
import {
  isVisibleToScreenReaders,
  isVisibleOnScreen,
  isFocusable,
  querySelectorAll,
} from "./dom";
import { getElementSpec, getAriaRolesByType } from "./stdhelpers";
import { sanitize, accessibleTextVirtual } from "./text";
import { isDataTable, toArray } from "./table";
import { checks, setDocument, CheckBuilder, type CheckDef } from "./checks";

// Wire role-based matchers into the core `matches()` used by getElementSpec.
registerMatchers({
  getExplicitRole: (v) => getExplicitRole(v),
  getImplicitRole: (v) => getImplicitRole(v),
  getRole: (v) => getRole(v),
  accessibleTextVirtual: (v) => accessibleTextVirtual(v),
});

export type RuleStatus = "pass" | "fail" | "incomplete" | "inapplicable";

// ── matches predicates ───────────────────────────────────────────

type MatchFn = (node: AnyNode, vNode: VNode) => boolean;

const isInitiator: MatchFn = () => true; // we only scan top-level documents

const noEmptyRole: MatchFn = (_node, vNode) => {
  if (!vNode.hasAttr("role")) return false;
  if (!(vNode.attr("role") || "").trim()) return false;
  return true;
};

const ariaAllowedRoleMatch: MatchFn = (_node, vNode) =>
  getExplicitRole(vNode, { dpub: true, fallback: true }) !== null;

const ariaHasAttr: MatchFn = (_node, vNode) =>
  vNode.attrNames.some((attr) => attr.startsWith("aria-"));

const ariaRequiredChildrenMatch: MatchFn = (_node, vNode) =>
  !!requiredOwned(getExplicitRole(vNode, { dpub: true }));

const ariaRequiredParentMatch: MatchFn = (_node, vNode) =>
  !!requiredContext(getExplicitRole(vNode));

const duplicateIdAriaMatch: MatchFn = (node) => isAccessibleRef(node);

const autocompleteMatch: MatchFn = (_node, vNode) => {
  const autocomplete = vNode.attr("autocomplete");
  if (!autocomplete || sanitize(autocomplete) === "") return false;
  const nodeName = vNode.props.nodeName;
  if (["textarea", "input", "select"].includes(nodeName) === false)
    return false;
  const ariaReadonly = vNode.attr("aria-readonly") || "false";
  if (vNode.hasAttr("readonly") || ariaReadonly.toLowerCase() === "true")
    return false;
  const excludedInputTypes = ["submit", "reset", "button", "hidden"];
  if (
    nodeName === "input" &&
    excludedInputTypes.includes(vNode.props.type as string)
  )
    return false;
  const ariaDisabled = vNode.attr("aria-disabled") || "false";
  if (vNode.hasAttr("disabled") || ariaDisabled.toLowerCase() === "true")
    return false;
  const role = getExplicitRole(vNode);
  const tabIndex = parseTabindex(vNode.attr("tabindex"));
  if (tabIndex !== null && tabIndex < 0 && vNode.hasAttr("role")) {
    const roleDef = ariaRoles[role as string];
    if (roleDef === undefined || roleDef.type !== "widget") return false;
  }
  if (
    tabIndex !== null &&
    tabIndex < 0 &&
    vNode.actualNode &&
    !isVisibleOnScreen(vNode) &&
    !isVisibleToScreenReaders(vNode)
  ) {
    return false;
  }
  return true;
};

const nestedInteractiveMatch: MatchFn = (_node, vNode) => {
  const role = getRole(vNode);
  if (!role) return false;
  return !!ariaRoles[role].childrenPresentational;
};

const dataTableLargeMatch: MatchFn = (node) => {
  if (isDataTable(node as never)) {
    const tableArray = toArray(node as never);
    return (
      tableArray.length >= 3 &&
      tableArray[0].length >= 3 &&
      tableArray[1].length >= 3 &&
      tableArray[2].length >= 3
    );
  }
  return false;
};

const dataTableMatch: MatchFn = (node) => isDataTable(node as never);

const tableOrGridRoleMatch: MatchFn = (_node, vNode) =>
  ["treegrid", "grid", "table"].includes(getRole(vNode) as string);

const noNegativeTabindexMatch: MatchFn = (_node, vNode) => {
  const tabindex = parseTabindex(vNode.attr("tabindex"));
  return tabindex === null || tabindex >= 0;
};

const frameTitleHasTextMatch: MatchFn = (node) => {
  const title = (
    node as unknown as { getAttribute: (a: string) => string | null }
  ).getAttribute("title");
  return !!sanitize(title);
};

const hasImplicitChromiumRoleMatch: MatchFn = (_node, vNode) =>
  getImplicitRole(vNode, { chromium: true }) !== null;

const noExplicitNameRequiredMatch: MatchFn = (_node, vNode) => {
  const role = getExplicitRole(vNode);
  if (!role || ["none", "presentation"].includes(role)) return true;
  const { accessibleNameRequired } = (ariaRoles[role] || {}) as {
    accessibleNameRequired?: boolean;
  };
  if (accessibleNameRequired || isFocusable(vNode)) return true;
  return false;
};

const labelMatch: MatchFn = (_node, vNode) => {
  if (vNode.props.nodeName !== "input" || vNode.hasAttr("type") === false)
    return true;
  const type = (vNode.attr("type") || "").toLowerCase();
  return (
    ["hidden", "image", "button", "submit", "reset"].includes(type) === false
  );
};

const noNamingMethodMatch: MatchFn = (_node, vNode) => {
  const { namingMethods } = getElementSpec(vNode) as {
    namingMethods?: string[];
  };
  if (namingMethods && namingMethods.length !== 0) return false;
  if (
    getExplicitRole(vNode) === "combobox" &&
    querySelectorAll(vNode, 'input:not([type="hidden"])').length
  ) {
    return false;
  }
  if (isComboboxPopup(vNode, { popupRoles: ["listbox"] })) return false;
  return true;
};

const landmarkUniqueMatch: MatchFn = (_node, vNode) =>
  isLandmark(vNode) && isVisibleToScreenReaders(vNode);

function isLandmark(vNode: VNode): boolean {
  const landmarkRoles = getAriaRolesByType("landmark");
  const role = getRole(vNode);
  if (!role) return false;
  const { nodeName } = vNode.props;
  if (nodeName === "section" || nodeName === "form") {
    return !!accessibleTextVirtual(vNode);
  }
  return landmarkRoles.indexOf(role) >= 0 || role === "region";
}

// ── rule definitions ─────────────────────────────────────────────

interface RuleDef {
  id: string;
  selector: string;
  matches?: MatchFn;
  excludeHidden: boolean;
  all: string[];
  any: string[];
  none: string[];
  /** Rules with `reviewOnFail:true` report violations as "incomplete". */
  reviewOnFail?: boolean;
}

const RULES: RuleDef[] = [
  {
    id: "aria-hidden-body",
    selector: "body",
    matches: isInitiator,
    excludeHidden: false,
    all: [],
    any: ["aria-hidden-body"],
    none: [],
  },
  {
    id: "aria-roles",
    selector: "[role]",
    matches: noEmptyRole,
    excludeHidden: true,
    all: [],
    any: [],
    none: ["invalidrole", "abstractrole", "unsupportedrole"],
  },
  {
    id: "aria-deprecated-role",
    selector: "[role]",
    matches: noEmptyRole,
    excludeHidden: true,
    all: [],
    any: [],
    none: ["deprecatedrole"],
  },
  {
    id: "aria-allowed-role",
    selector: "[role]",
    matches: ariaAllowedRoleMatch,
    excludeHidden: false,
    all: [],
    any: ["aria-allowed-role"],
    none: [],
  },
  {
    id: "aria-valid-attr",
    selector: "*",
    matches: ariaHasAttr,
    excludeHidden: true,
    all: [],
    any: ["aria-valid-attr"],
    none: [],
  },
  {
    id: "aria-valid-attr-value",
    selector: "*",
    matches: ariaHasAttr,
    excludeHidden: true,
    all: ["aria-valid-attr-value", "aria-errormessage", "aria-level"],
    any: [],
    none: [],
  },
  {
    id: "aria-allowed-attr",
    selector: "*",
    matches: ariaHasAttr,
    excludeHidden: true,
    all: ["aria-allowed-attr", "aria-allowed-attr-elm"],
    any: [],
    none: ["aria-unsupported-attr"],
  },
  {
    id: "aria-prohibited-attr",
    selector: "*",
    matches: ariaHasAttr,
    excludeHidden: true,
    all: [],
    any: [],
    none: ["aria-prohibited-attr"],
  },
  {
    id: "aria-required-attr",
    selector: "[role]",
    excludeHidden: true,
    all: [],
    any: ["aria-required-attr"],
    none: [],
  },
  {
    id: "aria-required-children",
    selector: "[role]",
    matches: ariaRequiredChildrenMatch,
    excludeHidden: true,
    all: [],
    any: ["aria-required-children"],
    none: [],
  },
  {
    id: "aria-required-parent",
    selector: "[role]",
    matches: ariaRequiredParentMatch,
    excludeHidden: true,
    all: [],
    any: ["aria-required-parent"],
    none: [],
  },
  {
    id: "duplicate-id-aria",
    selector: "[id]",
    matches: duplicateIdAriaMatch,
    excludeHidden: false,
    all: [],
    any: ["duplicate-id-aria"],
    none: [],
    reviewOnFail: true,
  },
  {
    id: "autocomplete-valid",
    selector: "*",
    matches: autocompleteMatch,
    excludeHidden: true,
    all: ["autocomplete-valid"],
    any: [],
    none: [],
  },
  {
    id: "nested-interactive",
    selector: "*",
    matches: nestedInteractiveMatch,
    excludeHidden: true,
    all: [],
    any: ["no-focusable-content"],
    none: [],
  },
  {
    id: "td-has-header",
    selector: "table",
    matches: dataTableLargeMatch,
    excludeHidden: true,
    all: ["td-has-header"],
    any: [],
    none: [],
  },
  {
    id: "th-has-data-cells",
    selector: "table",
    matches: dataTableMatch,
    excludeHidden: true,
    all: ["th-has-data-cells"],
    any: [],
    none: [],
  },
  {
    id: "td-headers-attr",
    selector: "table",
    matches: tableOrGridRoleMatch,
    excludeHidden: true,
    all: ["td-headers-attr"],
    any: [],
    none: [],
  },
  {
    id: "scope-attr-valid",
    selector: "td[scope], th[scope]",
    excludeHidden: true,
    all: ["html5-scope", "scope-value"],
    any: [],
    none: [],
  },
  {
    id: "document-title",
    selector: "html:not(html *)",
    matches: isInitiator,
    excludeHidden: true,
    all: [],
    any: ["doc-has-title"],
    none: [],
  },
  {
    id: "frame-title",
    selector: "frame, iframe",
    matches: noNegativeTabindexMatch,
    excludeHidden: true,
    all: [],
    any: [
      "non-empty-title",
      "aria-label",
      "aria-labelledby",
      "presentational-role",
    ],
    none: [],
  },
  {
    id: "frame-title-unique",
    selector: "frame[title], iframe[title]",
    matches: frameTitleHasTextMatch,
    excludeHidden: true,
    all: [],
    any: [],
    none: ["unique-frame-title"],
    reviewOnFail: true,
  },
  {
    id: "meta-refresh",
    selector: 'meta[http-equiv="refresh"][content]',
    excludeHidden: false,
    all: [],
    any: ["meta-refresh"],
    none: [],
  },
  {
    id: "tabindex",
    selector: "[tabindex]",
    excludeHidden: true,
    all: [],
    any: ["tabindex"],
    none: [],
  },
  // 'marquee' and 'blink' rules removed with the 7.22 audit they exclusively
  // backed (sunset, grade D): docs/evidence/sunset/not-a-factor.md#accessibilitymarquee.
  {
    id: "presentation-role-conflict",
    selector: 'img[alt=\'\'], [role="none"], [role="presentation"]',
    matches: hasImplicitChromiumRoleMatch,
    excludeHidden: true,
    all: [],
    any: [],
    none: ["is-element-focusable", "has-global-aria-attribute"],
  },
  // ── name/label/landmark rules (replace the hand-rolled cheerio audits) ──
  {
    id: "button-name",
    selector: "button",
    matches: noExplicitNameRequiredMatch,
    excludeHidden: true,
    all: [],
    any: [
      "button-has-visible-text",
      "aria-label",
      "aria-labelledby",
      "non-empty-title",
      "implicit-label",
      "explicit-label",
      "presentational-role",
    ],
    none: [],
  },
  {
    id: "link-name",
    selector: "a[href]",
    excludeHidden: true,
    all: [],
    any: [
      "has-visible-text",
      "aria-label",
      "aria-labelledby",
      "non-empty-title",
    ],
    none: ["focusable-no-name"],
  },
  {
    id: "label",
    selector: "input, textarea",
    matches: labelMatch,
    excludeHidden: true,
    all: [],
    any: [
      "implicit-label",
      "explicit-label",
      "aria-label",
      "aria-labelledby",
      "non-empty-title",
      "non-empty-placeholder",
      "presentational-role",
    ],
    none: ["hidden-explicit-label"],
  },
  {
    id: "select-name",
    selector: "select",
    excludeHidden: true,
    all: [],
    any: [
      "implicit-label",
      "explicit-label",
      "aria-label",
      "aria-labelledby",
      "non-empty-title",
      "presentational-role",
    ],
    none: ["hidden-explicit-label"],
  },
  {
    id: "aria-dialog-name",
    selector: '[role="dialog"], [role="alertdialog"]',
    matches: noNamingMethodMatch,
    excludeHidden: true,
    all: [],
    any: ["aria-label", "aria-labelledby", "non-empty-title"],
    none: [],
  },
  {
    id: "landmark-unique",
    selector:
      "[role=banner], [role=complementary], [role=contentinfo], [role=main], [role=navigation], [role=region], [role=search], [role=form], form, footer, header, aside, main, nav, section",
    matches: landmarkUniqueMatch,
    excludeHidden: true,
    all: [],
    any: ["landmark-is-unique"],
    none: [],
  },
];

export const SUPPORTED_RULE_IDS = RULES.map((r) => r.id);
const RULE_BY_ID = new Map(RULES.map((r) => [r.id, r]));

// ── check evaluation ─────────────────────────────────────────────

interface RawCheckResult {
  result: boolean | undefined;
  data: unknown;
  related: (VNode | AnyNode)[];
  vNode: VNode;
  node: AnyNode;
}

function runCheck(
  checkId: string,
  node: AnyNode,
  vNode: VNode,
): RawCheckResult {
  const def: CheckDef = checks[checkId];
  const builder = new CheckBuilder();
  let result: boolean | undefined;
  try {
    result = def.evaluate.call(builder, node, def.options ?? {}, vNode);
  } catch {
    result = undefined;
  }
  return {
    result,
    data: builder._data,
    related: builder._related,
    vNode,
    node,
  };
}

type GroupStatus = "pass" | "fail" | "incomplete";

function allStatus(results: (boolean | undefined)[]): GroupStatus {
  if (results.some((r) => r === false)) return "fail";
  if (results.some((r) => r === undefined)) return "incomplete";
  return "pass";
}
function noneStatus(results: (boolean | undefined)[]): GroupStatus {
  if (results.some((r) => r === true)) return "fail";
  if (results.some((r) => r === undefined)) return "incomplete";
  return "pass";
}
function anyStatus(results: (boolean | undefined)[]): GroupStatus {
  if (results.length === 0) return "pass";
  if (results.some((r) => r === true)) return "pass";
  if (results.some((r) => r === undefined)) return "incomplete";
  return "fail";
}

function combine(...statuses: GroupStatus[]): GroupStatus {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("incomplete")) return "incomplete";
  return "pass";
}

// ── selector / target helpers ────────────────────────────────────

function getSelector(node: AnyNode): string {
  const el = node as unknown as {
    nodeName: string;
    getAttribute?: (a: string) => string | null;
    id?: string;
    className?: string;
  };
  const tag = el.nodeName.toLowerCase();
  const id = el.id;
  if (id) return `${tag}#${id}`;
  const cls =
    typeof el.className === "string"
      ? el.className.trim().split(/\s+/).filter(Boolean)
      : [];
  if (cls.length) return `${tag}.${cls.slice(0, 2).join(".")}`;
  return tag;
}

export interface RuleNodeFinding {
  target: string;
  summary: string;
}
export interface RuleResult {
  status: RuleStatus;
  nodes: RuleNodeFinding[];
}

function qsa(doc: Document, selector: string): AnyNode[] {
  try {
    return Array.from(doc.querySelectorAll(selector));
  } catch {
    return [];
  }
}

/** Run a single rule against a document, returning its status + failing nodes. */
export function runRule(rule: RuleDef, doc: Document): RuleResult {
  const candidates = qsa(doc, rule.selector).filter((node) => {
    const vNode = toVNode(node);
    if (rule.matches && !rule.matches(node, vNode)) return false;
    if (rule.excludeHidden && !isVisibleToScreenReaders(vNode)) return false;
    return true;
  });

  if (candidates.length === 0) {
    return { status: "inapplicable", nodes: [] };
  }

  // Evaluate every check for every candidate up-front (needed for `after`).
  const checkIds = [...rule.all, ...rule.any, ...rule.none];
  const perNode = candidates.map((node) => {
    const vNode = toVNode(node);
    const byCheck: Record<string, RawCheckResult> = {};
    for (const cid of checkIds) byCheck[cid] = runCheck(cid, node, vNode);
    return { node, vNode, byCheck };
  });

  // Apply `after` reducers (operate across all nodes for a given check).
  for (const cid of checkIds) {
    const after = checks[cid].after;
    if (!after) continue;
    const list = perNode.map((p) => ({
      data: p.byCheck[cid].data,
      result: p.byCheck[cid].result,
    }));
    const reduced = after(list);
    // duplicate-id-after FILTERS; unique-frame-title-after rewrites results in
    // place. Map results back by reference, and drop nodes removed by filtering.
    const kept = new Set(reduced);
    let ri = 0;
    for (let i = 0; i < perNode.length; i++) {
      const entry = list[i];
      if (kept.has(entry)) {
        perNode[i].byCheck[cid].result = entry.result;
      } else {
        perNode[i].byCheck[cid]._removed = true;
      }
    }
    void ri;
  }

  let sawFail = false;
  let sawIncomplete = false;
  let sawPass = false;
  const failNodes: RuleNodeFinding[] = [];

  for (const p of perNode) {
    // A node removed by an `after` filter is dropped entirely.
    const removed = checkIds.some(
      (cid) => (p.byCheck[cid] as { _removed?: boolean })._removed,
    );
    if (removed) continue;

    const allRes = rule.all.map((cid) => p.byCheck[cid].result);
    const anyRes = rule.any.map((cid) => p.byCheck[cid].result);
    const noneRes = rule.none.map((cid) => p.byCheck[cid].result);
    const status = combine(
      allStatus(allRes),
      anyStatus(anyRes),
      noneStatus(noneRes),
    );

    if (status === "fail" && rule.reviewOnFail) {
      // These violations are converted to "needs review".
      sawIncomplete = true;
    } else if (status === "fail") {
      sawFail = true;
      if (failNodes.length < 5) {
        failNodes.push({ target: getSelector(p.node), summary: "" });
      }
    } else if (status === "incomplete") {
      sawIncomplete = true;
    } else {
      sawPass = true;
    }
  }

  if (sawFail) return { status: "fail", nodes: failNodes };
  if (sawIncomplete) return { status: "incomplete", nodes: [] };
  if (sawPass) return { status: "pass", nodes: [] };
  return { status: "inapplicable", nodes: [] };
}

/** Run the given rule ids against a document. */
export function runRules(
  doc: Document,
  ruleIds: string[],
): Record<string, RuleResult> {
  setDocument(doc);
  const out: Record<string, RuleResult> = {};
  for (const id of ruleIds) {
    const rule = RULE_BY_ID.get(id);
    if (!rule) continue;
    out[id] = runRule(rule, doc);
  }
  return out;
}

// Extend RawCheckResult typing for the `_removed` flag set above.
interface RawCheckResult {
  _removed?: boolean;
}
