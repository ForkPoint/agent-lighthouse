import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { runRules, SUPPORTED_RULE_IDS } from "./rules";

/**
 * One passing and one failing document per supported rule.
 *
 * The engine is a first-party reimplementation of 26 accessibility rules, and
 * every audit in `operability-safety` that reads `a11yResults` depends on it.
 * The per-audit tests mock `a11yResults` outright, so before this file nothing
 * exercised `checks.ts`, `aria.ts`, `text.ts`, `dom.ts` or `table.ts` against a
 * real DOM at all.
 *
 * Driving `runRules` rather than the individual check functions is deliberate:
 * a rule is only correct if its selector, its matcher and its checks agree, and
 * that is the contract `runner.ts` consumes.
 */

/** Wrap a body fragment in the minimum valid document. */
function doc(body: string, head = "<title>Test page</title>"): Document {
  return new JSDOM(
    `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`,
  ).window.document;
}

/** The status `runRules` reports for one rule against one document. */
function status(html: string, ruleId: string, head?: string): string {
  return runRules(doc(html, head), [ruleId])[ruleId]?.status ?? "missing";
}

interface Case {
  rule: string;
  /** Markup the rule must accept. */
  pass: string;
  /** Markup the rule must reject. */
  fail: string;
  /**
   * What rejection looks like for this rule. Four rules report `incomplete`
   * rather than `fail` by design, and that is a contract worth pinning:
   * `duplicate-id-aria` and `frame-title-unique` carry `reviewOnFail`, while
   * `th-has-data-cells` and `aria-prohibited-attr` return `undefined` from
   * their check when the answer needs a human. `runner.ts` maps `incomplete`
   * to a status the audits treat as "not a clean pass", never as a defect.
   */
  reject?: "fail" | "incomplete";
  /** Head markup, for the rules that live there. */
  head?: string;
  failHead?: string;
}

const CASES: Case[] = [
  {
    rule: "aria-allowed-attr",
    pass: '<div role="checkbox" aria-checked="false">Ship it</div>',
    fail: '<div role="heading" aria-level="2" aria-checked="false">Ship it</div>',
  },
  {
    rule: "aria-allowed-role",
    pass: '<a href="/x" role="button">Save</a>',
    fail: '<input type="checkbox" role="button">',
  },
  {
    rule: "aria-deprecated-role",
    pass: '<div role="navigation">Nav</div>',
    fail: '<div role="directory">Listing</div>',
  },
  {
    rule: "aria-dialog-name",
    pass: '<div role="dialog" aria-label="Size guide">Body</div>',
    fail: '<div role="dialog">Body</div>',
  },
  {
    rule: "aria-prohibited-attr",
    pass: '<div role="button" aria-label="Close">x</div>',
    fail: '<div role="paragraph" aria-label="Nope">Text</div>',
    reject: "incomplete",
  },
  {
    rule: "aria-required-attr",
    pass: '<div role="checkbox" aria-checked="true">Yes</div>',
    fail: '<div role="checkbox">Yes</div>',
  },
  {
    rule: "aria-required-children",
    pass: '<ul role="list"><li role="listitem">One</li></ul>',
    fail: '<div role="list"><span>Not a listitem</span></div>',
  },
  {
    rule: "aria-required-parent",
    pass: '<ul role="list"><li role="listitem">One</li></ul>',
    fail: '<div><span role="listitem">Orphan</span></div>',
  },
  {
    rule: "aria-roles",
    pass: '<div role="banner">Header</div>',
    fail: '<div role="not-a-real-role">Header</div>',
  },
  {
    rule: "aria-valid-attr",
    pass: '<div role="button" aria-label="Go">Go</div>',
    fail: '<div role="button" aria-labeledby="x">Go</div>',
  },
  {
    rule: "aria-valid-attr-value",
    pass: '<div role="checkbox" aria-checked="false">Pick</div>',
    fail: '<div role="checkbox" aria-checked="maybe">Pick</div>',
  },
  {
    rule: "autocomplete-valid",
    pass: '<form><input type="text" autocomplete="name"></form>',
    fail: '<form><input type="text" autocomplete="fullname"></form>',
  },
  {
    rule: "button-name",
    pass: "<button>Add to cart</button>",
    fail: "<button></button>",
  },
  {
    rule: "document-title",
    pass: "<p>Body</p>",
    fail: "<p>Body</p>",
    head: "<title>A real title</title>",
    failHead: "",
  },
  {
    rule: "duplicate-id-aria",
    pass: '<span id="lab-a">A</span><span id="lab-b">B</span><div role="button" aria-labelledby="lab-a">x</div>',
    fail: '<span id="dup">A</span><span id="dup">B</span><div role="button" aria-labelledby="dup">x</div>',
    reject: "incomplete",
  },
  {
    rule: "frame-title",
    pass: '<iframe title="Size chart" src="/x"></iframe>',
    fail: '<iframe src="/x"></iframe>',
  },
  {
    rule: "frame-title-unique",
    pass: '<iframe title="One" src="/a"></iframe><iframe title="Two" src="/b"></iframe>',
    fail: '<iframe title="Same" src="/a"></iframe><iframe title="Same" src="/b"></iframe>',
    reject: "incomplete",
  },
  {
    rule: "label",
    pass: '<label for="q">Search</label><input id="q" type="text">',
    fail: '<input id="q" type="text">',
  },
  {
    rule: "landmark-unique",
    pass: '<nav aria-label="Primary"><a href="/a">A</a></nav><nav aria-label="Footer"><a href="/b">B</a></nav>',
    fail: '<nav aria-label="Primary"><a href="/a">A</a></nav><nav aria-label="Primary"><a href="/b">B</a></nav>',
  },
  {
    rule: "link-name",
    pass: '<a href="/product">Buy the thing</a>',
    fail: '<a href="/product"></a>',
  },
  {
    rule: "meta-refresh",
    pass: "<p>Body</p>",
    fail: "<p>Body</p>",
    head: "<title>T</title>",
    failHead:
      '<title>T</title><meta http-equiv="refresh" content="5; url=/next">',
  },
  {
    rule: "nested-interactive",
    pass: '<button>Save</button><a href="/x">Link</a>',
    fail: '<button>Save <a href="/x">Link</a></button>',
  },
  {
    rule: "presentation-role-conflict",
    pass: '<img src="/x.png" role="presentation" alt="">',
    fail: '<img src="/x.png" role="presentation" alt="" tabindex="0" aria-label="Chart">',
  },
  {
    rule: "scope-attr-valid",
    pass: '<table><tr><th scope="col">Size</th></tr><tr><td>M</td></tr></table>',
    fail: '<table><tr><th scope="sideways">Size</th></tr><tr><td>M</td></tr></table>',
  },
  {
    rule: "select-name",
    pass: '<label for="s">Size</label><select id="s"><option>M</option></select>',
    fail: "<select><option>M</option></select>",
  },
  {
    rule: "tabindex",
    pass: '<button tabindex="0">Save</button>',
    fail: '<button tabindex="3">Save</button>',
  },
  {
    rule: "td-has-header",
    pass:
      '<table><tr><th scope="col">A</th><th scope="col">B</th><th scope="col">C</th><th scope="col">D</th></tr>' +
      "<tr><td>1</td><td>2</td><td>3</td><td>4</td></tr><tr><td>5</td><td>6</td><td>7</td><td>8</td></tr>" +
      "<tr><td>9</td><td>10</td><td>11</td><td>12</td></tr></table>",
    fail:
      "<table><tr><td>1</td><td>2</td><td>3</td><td>4</td></tr><tr><td>5</td><td>6</td><td>7</td><td>8</td></tr>" +
      "<tr><td>9</td><td>10</td><td>11</td><td>12</td></tr><tr><td>13</td><td>14</td><td>15</td><td>16</td></tr></table>",
  },
  {
    rule: "td-headers-attr",
    pass: '<table id="t"><tr><th id="h1">A</th></tr><tr><td headers="h1">1</td></tr></table>',
    fail: '<table id="t"><tr><th id="h1">A</th></tr><tr><td headers="nope">1</td></tr></table>',
  },
  {
    rule: "th-has-data-cells",
    pass: '<table><tr><th scope="col">A</th></tr><tr><td>1</td></tr></table>',
    fail: '<table><tr><th scope="col">A</th></tr><tr><th scope="col">B</th></tr></table>',
    reject: "incomplete",
  },
];

describe("accessibility engine — rule conformance", () => {
  it("covers every rule the engine registers", () => {
    // `aria-hidden-body` cannot be written as a body fragment — it is asserted
    // on its own below — so it is the one id allowed to be absent from CASES.
    const tested = new Set([...CASES.map((c) => c.rule), "aria-hidden-body"]);
    const registered = new Set(SUPPORTED_RULE_IDS);
    expect([...registered].filter((id) => !tested.has(id))).toEqual([]);
    expect([...tested].filter((id) => !registered.has(id))).toEqual([]);
  });

  for (const c of CASES) {
    it(`${c.rule}: accepts conforming markup`, () => {
      expect(status(c.pass, c.rule, c.head)).not.toBe("fail");
    });

    it(`${c.rule}: rejects violating markup`, () => {
      expect(status(c.fail, c.rule, c.failHead ?? c.head)).toBe(
        c.reject ?? "fail",
      );
    });
  }

  // The two document-level rules cannot be expressed as a body fragment.
  it("aria-hidden-body fails a document whose <body> is aria-hidden", () => {
    const d = new JSDOM(
      '<!doctype html><html lang="en"><head><title>T</title></head><body aria-hidden="true"><p>Hi</p></body></html>',
    ).window.document;
    expect(runRules(d, ["aria-hidden-body"])["aria-hidden-body"]?.status).toBe(
      "fail",
    );
  });

  it("document-title fails a document with an empty <title>", () => {
    const d = new JSDOM(
      '<!doctype html><html lang="en"><head><title>  </title></head><body><p>Hi</p></body></html>',
    ).window.document;
    expect(runRules(d, ["document-title"])["document-title"]?.status).toBe(
      "fail",
    );
  });

  it("reports the offending node so a report can point at it", () => {
    const result = runRules(doc("<button></button>"), ["button-name"])[
      "button-name"
    ];
    expect(result?.status).toBe("fail");
    expect(result?.nodes.length).toBeGreaterThan(0);
    expect(result?.nodes[0]?.target).toContain("button");
  });

  it("reports inapplicable when the rule has nothing to look at", () => {
    expect(status("<p>Prose only.</p>", "button-name")).toBe("inapplicable");
    expect(status("<p>Prose only.</p>", "frame-title")).toBe("inapplicable");
    expect(status("<p>Prose only.</p>", "td-has-header")).toBe("inapplicable");
  });

  it("ignores an unknown rule id instead of throwing", () => {
    expect(runRules(doc("<p>x</p>"), ["no-such-rule"])).toEqual({});
  });

  it("runs every rule over one document without throwing", () => {
    const d = doc(
      '<header><nav aria-label="Primary"><a href="/a">A</a></nav></header>' +
        '<main><h1>Title</h1><form><label for="q">Search</label><input id="q"></form>' +
        '<table><tr><th scope="col">A</th></tr><tr><td>1</td></tr></table></main>' +
        "<footer><button>Save</button></footer>",
    );
    const results = runRules(d, [...SUPPORTED_RULE_IDS]);
    expect(Object.keys(results).length).toBe(SUPPORTED_RULE_IDS.length);
    for (const [id, r] of Object.entries(results)) {
      expect(["pass", "fail", "incomplete", "inapplicable"], id).toContain(
        r.status,
      );
    }
  });
});
