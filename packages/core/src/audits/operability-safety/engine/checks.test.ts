import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { runRules, RuleStatus } from "./rules";
import { checks, CheckBuilder, setDocument } from "./checks";
import { toVNode } from "./core";

/**
 * Per-check verdicts, driven through `runRules`.
 *
 * `rules.conformance.test.ts` pins one passing and one failing document per
 * rule. A rule's checks branch far more than that: a check can pass on an
 * exception the spec carves out, defer to a human with `undefined`, or fail
 * for a reason the single conformance case never reaches. Each case below
 * names the branch it pins and the verdict that branch must produce.
 *
 * The expected verdicts follow the documented semantics of the axe-core
 * checks these functions port: `true` passes, `false` fails, `undefined`
 * surfaces as `incomplete`.
 */

/** Build a document and register it as the engine's current document. */
function build(body: string, opts: { head?: string; doctype?: string } = {}) {
  const doctype = opts.doctype ?? "<!doctype html>";
  const head = opts.head ?? "<title>Test page</title>";
  return new JSDOM(
    `${doctype}<html lang="en"><head>${head}</head><body>${body}</body></html>`,
  ).window.document;
}

/** The status `runRules` reports for one rule against one body fragment. */
function status(
  body: string,
  ruleId: string,
  opts: { head?: string; doctype?: string } = {},
): string {
  return runRules(build(body, opts), [ruleId])[ruleId]?.status ?? "missing";
}

/** Evaluate a single check directly, for options the registry never passes. */
function evaluate(
  checkId: string,
  body: string,
  options: Record<string, unknown>,
  selector = "#t",
): { result: boolean | undefined; data: unknown } {
  const d = build(body);
  setDocument(d);
  const node = d.querySelector(selector);
  if (!node) throw new Error(`no element matched ${selector}`);
  const def = checks[checkId];
  if (!def) throw new Error(`no check ${checkId}`);
  const builder = new CheckBuilder();
  const result = def.evaluate.call(builder, node, options, toVNode(node));
  return { result, data: builder._data };
}

describe("rule candidate filtering", () => {
  // Rules with excludeHidden drop nodes a screen reader never reaches.
  it("ignores a candidate hidden from screen readers", () => {
    expect(status('<button aria-hidden="true"></button>', "button-name")).toBe(
      RuleStatus.Inapplicable,
    );
  });

  it("targets a failing node by tag and its first two classes", () => {
    const d = build('<button class="cta big red"></button>');
    const result = runRules(d, ["button-name"])["button-name"];
    expect(result?.status).toBe(RuleStatus.Fail);
    expect(result?.nodes[0]?.target).toBe("button.cta.big");
  });

  // SVG className is an SVGAnimatedString, not a string.
  it("targets a failing SVG element by tag alone", () => {
    const d = build('<svg class="icon" role="foo"></svg>');
    const result = runRules(d, ["aria-roles"])["aria-roles"];
    expect(result?.status).toBe(RuleStatus.Fail);
    expect(result?.nodes[0]?.target).toBe("svg");
  });

  it("caps the reported failing nodes at five", () => {
    const d = build("<button></button>".repeat(7));
    const result = runRules(d, ["button-name"])["button-name"];
    expect(result?.status).toBe(RuleStatus.Fail);
    expect(result?.nodes).toHaveLength(5);
  });
});

describe("aria-roles", () => {
  it("fails an abstract role", () => {
    expect(status('<div role="command">x</div>', "aria-roles")).toBe(
      RuleStatus.Fail,
    );
  });

  it("passes a role list whose fallback is valid", () => {
    expect(status('<div role="foo button">x</div>', "aria-roles")).toBe(
      RuleStatus.Pass,
    );
  });

  it("fails a role list where every token is invalid", () => {
    expect(status('<div role="foo bar">x</div>', "aria-roles")).toBe(
      RuleStatus.Fail,
    );
  });

  it("does not apply to a whitespace-only role", () => {
    expect(status('<div role="   ">x</div>', "aria-roles")).toBe(
      RuleStatus.Inapplicable,
    );
  });
});

describe("aria-deprecated-role", () => {
  it("passes a current role", () => {
    expect(status('<div role="button">x</div>', "aria-deprecated-role")).toBe(
      RuleStatus.Pass,
    );
  });
});

describe("aria-allowed-role", () => {
  it("allows the element's own implicit role", () => {
    expect(
      status('<button role="button">x</button>', "aria-allowed-role"),
    ).toBe(RuleStatus.Pass);
  });

  // The rule keeps hidden candidates, and the check defers on them.
  it("asks for review when the unallowed role is hidden from screen readers", () => {
    expect(
      status(
        '<input type="checkbox" role="button" aria-hidden="true">',
        "aria-allowed-role",
      ),
    ).toBe(RuleStatus.Incomplete);
  });

  // A DPUB fallback role is only allowed where its type matches the element's
  // implicit role.
  it("fails a DPUB link role on an element that is not a link", () => {
    expect(
      status('<div role="doc-backlink">Back</div>', "aria-allowed-role"),
    ).toBe(RuleStatus.Fail);
  });

  it("allows a DPUB link role on a link", () => {
    expect(
      status(
        '<a href="#ref" role="doc-backlink">Back</a>',
        "aria-allowed-role",
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("skips an ignored tag when the option names it", () => {
    expect(
      evaluate(
        "aria-allowed-role",
        '<input id="t" type="checkbox" role="button">',
        {
          ignoredTags: ["INPUT"],
        },
      ).result,
    ).toBe(true);
  });
});

describe("aria-valid-attr", () => {
  it("accepts an unknown aria-* attribute the options allow", () => {
    expect(
      evaluate("aria-valid-attr", '<div id="t" aria-foo="1">x</div>', {
        value: ["aria-foo"],
      }).result,
    ).toBe(true);
  });
});

describe("aria-valid-attr-value", () => {
  const rule = "aria-valid-attr-value";

  it("fails aria-controls that points at nothing", () => {
    expect(status('<button aria-controls="missing">Menu</button>', rule)).toBe(
      RuleStatus.Fail,
    );
  });

  // A collapsed control may reference content that is not rendered yet.
  it("passes a dangling aria-controls on a collapsed control", () => {
    expect(
      status(
        '<button aria-expanded="false" aria-controls="missing">Menu</button>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("passes a dangling aria-controls on an unselected tab", () => {
    expect(
      status(
        '<div role="tablist"><div role="tab" aria-selected="false" aria-controls="missing">A</div></div>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("asks for review when a popup control references a missing id", () => {
    expect(
      status(
        '<button aria-haspopup="true" aria-controls="missing">Menu</button>',
        rule,
      ),
    ).toBe(RuleStatus.Incomplete);
  });

  it("asks for review on an unknown aria-current token", () => {
    expect(status('<a href="/" aria-current="bogus">Home</a>', rule)).toBe(
      RuleStatus.Incomplete,
    );
  });

  it("passes a known aria-current token", () => {
    expect(status('<a href="/" aria-current="page">Home</a>', rule)).toBe(
      RuleStatus.Pass,
    );
  });

  it("fails aria-owns that points at nothing", () => {
    expect(
      status('<div role="listbox" aria-owns="missing">x</div>', rule),
    ).toBe(RuleStatus.Fail);
  });

  it("passes a dangling aria-owns on a collapsed element", () => {
    expect(
      status(
        '<div role="combobox" aria-expanded="false" aria-controls="lb" aria-owns="missing">x</div><div id="lb" role="listbox"></div>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("asks for review on aria-describedby that points at nothing", () => {
    expect(status('<button aria-describedby="missing">Go</button>', rule)).toBe(
      RuleStatus.Incomplete,
    );
  });

  it("asks for review on aria-labelledby that points at nothing", () => {
    expect(status('<button aria-labelledby="missing">Go</button>', rule)).toBe(
      RuleStatus.Incomplete,
    );
  });

  it("asks for review on an empty value an attribute does not allow", () => {
    expect(
      status('<div role="slider" aria-valuenow="" tabindex="0">x</div>', rule),
    ).toBe(RuleStatus.Incomplete);
  });

  it("fails a malformed value on a non-string attribute", () => {
    expect(
      status(
        '<div role="slider" aria-valuenow="lots" tabindex="0">x</div>',
        rule,
      ),
    ).toBe(RuleStatus.Fail);
  });

  it("ignores an attribute named in the options", () => {
    expect(
      evaluate(
        "aria-valid-attr-value",
        '<div id="t" role="checkbox" aria-checked="maybe">x</div>',
        { value: ["aria-checked"] },
      ).result,
    ).toBe(true);
  });

  describe("aria-errormessage", () => {
    it("passes when aria-invalid is false", () => {
      expect(
        status(
          '<input aria-label="Email" aria-invalid="false" aria-errormessage="missing">',
          rule,
        ),
      ).toBe(RuleStatus.Pass);
    });

    it("passes an error message announced by role=alert", () => {
      expect(
        status(
          '<input aria-label="Email" aria-invalid="true" aria-errormessage="err"><div id="err" role="alert">Bad</div>',
          rule,
        ),
      ).toBe(RuleStatus.Pass);
    });

    it.each(["assertive", "polite"])(
      "passes an error message in an aria-live=%s region",
      (live) => {
        expect(
          status(
            `<input aria-label="Email" aria-invalid="true" aria-errormessage="err"><div id="err" aria-live="${live}">Bad</div>`,
            rule,
          ),
        ).toBe(RuleStatus.Pass);
      },
    );

    it("passes an error message also referenced by aria-describedby", () => {
      expect(
        status(
          '<input aria-label="Email" aria-invalid="true" aria-errormessage="err" aria-describedby="err"><div id="err">Bad</div>',
          rule,
        ),
      ).toBe(RuleStatus.Pass);
    });

    it("fails an error message nothing announces", () => {
      expect(
        status(
          '<input aria-label="Email" aria-invalid="true" aria-errormessage="err"><div id="err">Bad</div>',
          rule,
        ),
      ).toBe(RuleStatus.Fail);
    });

    it("fails an error message hidden from screen readers", () => {
      expect(
        status(
          '<input aria-label="Email" aria-invalid="true" aria-errormessage="err"><div id="err" role="alert" hidden>Bad</div>',
          rule,
        ),
      ).toBe(RuleStatus.Fail);
    });

    it("fails more than one error message id", () => {
      expect(
        status(
          '<input aria-label="Email" aria-invalid="true" aria-errormessage="a b"><div id="a" role="alert">A</div><div id="b" role="alert">B</div>',
          rule,
        ),
      ).toBe(RuleStatus.Fail);
    });

    it("asks for review when the error message id resolves to nothing", () => {
      expect(
        status(
          '<input aria-label="Email" aria-invalid="true" aria-errormessage="missing">',
          rule,
        ),
      ).toBe(RuleStatus.Incomplete);
    });

    it("passes an empty aria-errormessage, which the attribute allows", () => {
      expect(
        status(
          '<input aria-label="Email" aria-invalid="true" aria-errormessage=" ">',
          rule,
        ),
      ).toBe(RuleStatus.Pass);
    });

    it("passes when the options exempt the referenced id", () => {
      expect(
        evaluate(
          "aria-errormessage",
          '<input id="t" aria-invalid="true" aria-errormessage="err"><div id="err">Bad</div>',
          ["err"] as unknown as Record<string, unknown>,
        ).result,
      ).toBe(true);
    });
  });

  it("asks for review on an aria-level above 6", () => {
    expect(status('<div role="heading" aria-level="8">Deep</div>', rule)).toBe(
      RuleStatus.Incomplete,
    );
  });
});

describe("aria-allowed-attr", () => {
  const rule = "aria-allowed-attr";

  it("tolerates aria-required=false where aria-required is not allowed", () => {
    expect(
      status('<div role="button" aria-required="false">x</div>', rule),
    ).toBe(RuleStatus.Pass);
  });

  it("fails aria-required=true where aria-required is not allowed", () => {
    expect(
      status('<div role="button" aria-required="true">x</div>', rule),
    ).toBe(RuleStatus.Fail);
  });

  it("tolerates aria-multiline=false on a contenteditable element", () => {
    expect(
      status(
        '<div role="button" contenteditable="true" aria-multiline="false">x</div>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("fails aria-multiline=false without contenteditable", () => {
    expect(
      status('<div role="button" aria-multiline="false">x</div>', rule),
    ).toBe(RuleStatus.Fail);
  });

  // An unknown custom element may carry semantics the engine cannot see.
  it("asks for review on a custom element with no role", () => {
    expect(status('<my-widget aria-checked="true">x</my-widget>', rule)).toBe(
      RuleStatus.Incomplete,
    );
  });

  it("merges extra allowed attributes for a role from the options", () => {
    expect(
      evaluate(
        "aria-allowed-attr",
        '<div id="t" role="button" aria-checked="true">x</div>',
        {
          button: ["aria-checked"],
        },
      ).result,
    ).toBe(true);
  });

  // `br` and `wbr` restrict ARIA to aria-hidden.
  it("fails a global ARIA attribute the element spec forbids", () => {
    expect(status('<p>a<br aria-label="break">b</p>', rule)).toBe(
      RuleStatus.Fail,
    );
  });

  it("passes an ARIA attribute the element spec allows", () => {
    expect(status('<p>a<br aria-hidden="false">b</p>', rule)).toBe(
      RuleStatus.Pass,
    );
  });

  it("defers element restrictions to the explicit role", () => {
    expect(status('<p>a<br role="none" aria-hidden="false">b</p>', rule)).toBe(
      RuleStatus.Pass,
    );
  });
});

describe("aria-prohibited-attr", () => {
  const rule = "aria-prohibited-attr";

  it("fails a name on a role that prohibits one when there is no text", () => {
    expect(status('<div role="paragraph" aria-label="Nope"></div>', rule)).toBe(
      RuleStatus.Fail,
    );
  });

  it("fails a name on a generic element with no text", () => {
    expect(
      status('<div aria-label="Nope" aria-labelledby="x"></div>', rule),
    ).toBe(RuleStatus.Fail);
  });

  it("asks for review on a name on a generic element with text", () => {
    expect(status('<span aria-label="Nope">Text</span>', rule)).toBe(
      RuleStatus.Incomplete,
    );
  });

  it("allows a name on an element listed in the options", () => {
    expect(status('<input aria-label="Search">', rule)).toBe(RuleStatus.Pass);
  });

  it("allows a name on a generic element inside a widget", () => {
    expect(
      status(
        '<div role="button" tabindex="0"><span aria-label="Close"></span></div>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("ignores a prohibited attribute whose value is blank", () => {
    expect(status('<div aria-label="  ">x</div>', rule)).toBe(RuleStatus.Pass);
  });
});

describe("aria-required-attr", () => {
  const rule = "aria-required-attr";

  it("passes an invalid role, which has nothing to require", () => {
    expect(status('<div role="foo">x</div>', rule)).toBe(RuleStatus.Pass);
  });

  it("passes a static separator without aria-valuenow", () => {
    expect(status('<div role="separator"></div>', rule)).toBe(RuleStatus.Pass);
  });

  it("fails a focusable separator without aria-valuenow", () => {
    expect(status('<div role="separator" tabindex="0"></div>', rule)).toBe(
      RuleStatus.Fail,
    );
  });

  it("passes a collapsed combobox without aria-controls", () => {
    expect(
      status('<div role="combobox" aria-expanded="false">x</div>', rule),
    ).toBe(RuleStatus.Pass);
  });

  it("fails an expanded combobox without aria-controls", () => {
    expect(
      status('<div role="combobox" aria-expanded="true">x</div>', rule),
    ).toBe(RuleStatus.Fail);
  });

  it("passes a slider named by aria-valuetext instead of aria-valuenow", () => {
    expect(
      status(
        '<div role="slider" aria-valuetext="Medium" tabindex="0">x</div>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("counts a native element's implicit state as the required attribute", () => {
    expect(status('<input type="checkbox" role="switch">', rule)).toBe(
      RuleStatus.Pass,
    );
  });

  it("adds required attributes for a role from the options", () => {
    expect(
      evaluate("aria-required-attr", '<div id="t" role="button">x</div>', {
        button: ["aria-pressed"],
      }).result,
    ).toBe(false);
  });
});

describe("aria-required-children", () => {
  const rule = "aria-required-children";

  it("fails an owned element with a role the parent does not allow", () => {
    expect(
      status('<div role="list"><div role="button">x</div></div>', rule),
    ).toBe(RuleStatus.Fail);
  });

  it("fails a focusable owned element with no role", () => {
    expect(
      status('<div role="list"><span tabindex="0">x</span></div>', rule),
    ).toBe(RuleStatus.Fail);
  });

  it("fails a native button owned by a list", () => {
    expect(status('<div role="list"><button>x</button></div>', rule)).toBe(
      RuleStatus.Fail,
    );
  });

  it("fails an owned element with a global ARIA attribute", () => {
    expect(
      status('<div role="list"><span aria-label="x">y</span></div>', rule),
    ).toBe(RuleStatus.Fail);
  });

  it("still fails an unallowed child while the parent is busy", () => {
    expect(
      status(
        '<div role="list" aria-busy="true"><div role="button">x</div></div>',
        rule,
      ),
    ).toBe(RuleStatus.Fail);
  });

  it("passes an empty parent that is busy", () => {
    expect(status('<div role="list" aria-busy="true"></div>', rule)).toBe(
      RuleStatus.Pass,
    );
  });

  // `list` is in reviewEmpty: an empty list may be filled later.
  it("asks for review on an empty list", () => {
    expect(status('<div role="list"></div>', rule)).toBe(RuleStatus.Incomplete);
  });

  it("fails an empty parent whose role is not reviewed when empty", () => {
    expect(status('<div role="table"><div role="row"></div></div>', rule)).toBe(
      RuleStatus.Fail,
    );
  });

  it("descends through a group the parent accepts", () => {
    expect(
      status(
        '<div role="menu"><div role="group"><div role="menuitem">A</div></div></div>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("follows aria-owns to the required children", () => {
    expect(
      status(
        '<div role="list" aria-owns="i1"></div><div id="i1" role="listitem">A</div>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });
});

describe("aria-required-parent", () => {
  const rule = "aria-required-parent";

  it("passes a treeitem grouped inside a tree", () => {
    expect(
      status(
        '<div role="tree"><div role="group"><div role="treeitem">A</div></div></div>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("fails a treeitem whose group has no tree", () => {
    expect(
      status('<div role="group"><div role="treeitem">A</div></div>', rule),
    ).toBe(RuleStatus.Fail);
  });

  it("passes a listitem owned through aria-owns", () => {
    expect(
      status(
        '<div role="list" aria-owns="i1 i2"></div><div><span id="i1" role="listitem">A</span><span id="i2" role="listitem">B</span></div>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });

  // Only the first owner of an id counts, as `querySelector` would return it.
  it("judges a listitem by the first element that owns it", () => {
    expect(
      status(
        '<div role="list" aria-owns="  i1"></div><div role="menu" aria-owns="i1"></div><span id="i1" role="listitem">A</span>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
    expect(
      status(
        '<div role="menu" aria-owns="i1"></div><div role="list" aria-owns="i1"></div><span id="i1" role="listitem">A</span>',
        rule,
      ),
    ).toBe(RuleStatus.Fail);
  });

  it("passes a listitem whose ancestor is owned through aria-owns", () => {
    expect(
      status(
        '<div role="list" aria-owns="wrap"></div><div id="wrap"><span role="listitem">A</span></div>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("fails a listitem when aria-owns elsewhere does not own it", () => {
    expect(
      status(
        '<div role="list" aria-owns="other"></div><div id="other"></div><span role="listitem">A</span>',
        rule,
      ),
    ).toBe(RuleStatus.Fail);
  });

  it("fails a listitem owned by an element of the wrong role", () => {
    expect(
      status(
        '<div role="menu" aria-owns="i1"></div><span id="i1" role="listitem">A</span>',
        rule,
      ),
    ).toBe(RuleStatus.Fail);
  });
});

describe("nested-interactive", () => {
  it("fails focusable content removed from the tab order only by tabindex", () => {
    expect(
      status(
        '<button>Save <a href="/x" tabindex="-1">x</a></button>',
        "nested-interactive",
      ),
    ).toBe(RuleStatus.Fail);
  });
});

describe("td-headers-attr", () => {
  const rule = "td-headers-attr";

  it("asks for review on an empty headers attribute", () => {
    expect(
      status(
        '<table><tr><th id="h">A</th></tr><tr><td headers=" ">1</td></tr></table>',
        rule,
      ),
    ).toBe(RuleStatus.Incomplete);
  });

  it("fails a cell that names itself as its header", () => {
    expect(
      status(
        '<table><tr><th id="h">A</th></tr><tr><td id="c" headers="c">1</td></tr></table>',
        rule,
      ),
    ).toBe(RuleStatus.Fail);
  });

  it("fails a headers reference to a data cell", () => {
    expect(
      status(
        '<table><tr><td id="d">A</td></tr><tr><td headers="d">1</td></tr></table>',
        rule,
      ),
    ).toBe(RuleStatus.Fail);
  });

  it("ignores a headers attribute on a hidden cell", () => {
    expect(
      status(
        '<table><tr><th id="h">A</th></tr><tr><td headers="nope" aria-hidden="true">1</td></tr></table>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });
});

describe("th-has-data-cells", () => {
  const rule = "th-has-data-cells";

  // The header sits right of its only cell, so the grid walk finds nothing;
  // only the explicit reference connects them.
  it("passes a header referenced by a cell's headers attribute", () => {
    expect(
      status(
        '<table><tr><td headers="h">1</td><th id="h" scope="col">A</th></tr></table>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("asks for review on the same header once the reference is gone", () => {
    expect(
      status(
        '<table><tr><td>1</td><th id="h" scope="col">A</th></tr></table>',
        rule,
      ),
    ).toBe(RuleStatus.Incomplete);
  });

  it("passes a header referenced through aria-labelledby", () => {
    expect(
      status(
        '<table><tr><th id="h" scope="col">A</th></tr><tr><th scope="col">B</th></tr><tr><td aria-labelledby="h">1</td></tr></table>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("passes a row header with a data cell to its right", () => {
    expect(
      status(
        '<table><tr><th scope="row">A</th><td>1</td></tr><tr><th scope="row">B</th><td>2</td></tr></table>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("asks for review on a row header with no data cell", () => {
    expect(
      status(
        '<table><tr><th scope="row">A</th></tr><tr><th scope="row">B</th><td>2</td></tr></table>',
        rule,
      ),
    ).toBe(RuleStatus.Incomplete);
  });

  it("ignores an empty header cell", () => {
    expect(
      status(
        '<table><tr><th></th><th scope="col">A</th></tr><tr><th scope="row">B</th><td>1</td></tr></table>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("treats role=columnheader as a header", () => {
    expect(
      status(
        '<table><tr><td role="columnheader">A</td></tr><tr><td>1</td></tr></table>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });
});

describe("scope-attr-valid", () => {
  const rule = "scope-attr-valid";

  it("fails scope on a td in an HTML5 document", () => {
    expect(
      status(
        '<table><tr><td scope="col">A</td></tr><tr><td>1</td></tr></table>',
        rule,
      ),
    ).toBe(RuleStatus.Fail);
  });

  it("accepts scope on a td in a pre-HTML5 document", () => {
    expect(
      status(
        '<table><tr><td scope="col">A</td></tr><tr><td>1</td></tr></table>',
        rule,
        {
          doctype:
            '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">',
        },
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("matches the scope value case-insensitively", () => {
    expect(
      status(
        '<table><tr><th scope="COL">A</th></tr><tr><td>1</td></tr></table>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });
});

describe("frame-title", () => {
  const rule = "frame-title";

  it("does not apply to a frame removed from the tab order", () => {
    expect(status('<iframe src="/x" tabindex="-1"></iframe>', rule)).toBe(
      RuleStatus.Inapplicable,
    );
  });

  it("fails a whitespace-only title", () => {
    expect(status('<iframe src="/x" title="   "></iframe>', rule)).toBe(
      RuleStatus.Fail,
    );
  });

  it("passes a frame named by aria-label", () => {
    expect(status('<iframe src="/x" aria-label="Map"></iframe>', rule)).toBe(
      RuleStatus.Pass,
    );
  });

  it("passes a presentational frame", () => {
    expect(status('<iframe src="/x" role="none"></iframe>', rule)).toBe(
      RuleStatus.Pass,
    );
  });

  // A titled frame is not presentational: the title still names it.
  it("does not count a titled frame as presentational", () => {
    const { result, data } = evaluate(
      "presentational-role",
      '<iframe id="t" src="/x" role="presentation" title="Map"></iframe>',
      {},
    );
    expect(result).toBe(false);
    expect(data).toEqual({ messageKey: "iframe", nodeName: "iframe" });
  });

  it("rejects attr-non-space-content without an attribute option", () => {
    expect(() =>
      evaluate("non-empty-title", '<iframe id="t" title="x"></iframe>', {}),
    ).toThrow(TypeError);
  });
});

describe("presentational-role in name rules", () => {
  // A focusable element cannot be made presentational, so the role does not
  // excuse a missing name.
  it("fails a focusable button marked presentational", () => {
    expect(status('<button role="presentation"></button>', "button-name")).toBe(
      RuleStatus.Fail,
    );
  });

  it("fails a select marked presentational but carrying global ARIA", () => {
    expect(
      status(
        '<select role="none" disabled aria-describedby="d"><option>A</option></select><p id="d">Hint</p>',
        "select-name",
      ),
    ).toBe(RuleStatus.Fail);
  });

  it("fails a focusable control with global ARIA marked presentational", () => {
    expect(
      status(
        '<input role="none" aria-describedby="d"><p id="d">Hint</p>',
        "label",
      ),
    ).toBe(RuleStatus.Fail);
  });

  it("passes a disabled control that is genuinely presentational", () => {
    expect(status('<input role="none" disabled>', "label")).toBe(
      RuleStatus.Pass,
    );
  });
});

describe("meta-refresh", () => {
  const rule = "meta-refresh";
  const meta = (content: string) =>
    status("<p>x</p>", rule, {
      head: `<title>T</title><meta http-equiv="refresh" content="${content}">`,
    });

  it("passes an immediate redirect", () => {
    expect(meta("0; url=/next")).toBe(RuleStatus.Pass);
  });

  it("passes a refresh longer than twenty hours", () => {
    expect(meta("72001")).toBe(RuleStatus.Pass);
  });

  it("passes content that does not start with a delay", () => {
    expect(meta("url=/next")).toBe(RuleStatus.Pass);
  });

  it("fails a timed refresh written with a comma separator", () => {
    expect(meta("30,url=/next")).toBe(RuleStatus.Fail);
  });
});

describe("autocomplete-valid applicability", () => {
  const rule = "autocomplete-valid";

  it.each([
    ['<div autocomplete="name">x</div>', "a non-form element"],
    ['<input autocomplete="nope" readonly>', "a readonly input"],
    [
      '<input autocomplete="nope" aria-readonly="true">',
      "an aria-readonly input",
    ],
    ['<input type="submit" autocomplete="nope">', "a submit button"],
    ['<input autocomplete="nope" disabled>', "a disabled input"],
    [
      '<input autocomplete="nope" aria-disabled="true">',
      "an aria-disabled input",
    ],
    ['<input autocomplete="  ">', "a blank autocomplete"],
    [
      '<input autocomplete="nope" tabindex="-1" role="presentation">',
      "an unfocusable input with a non-widget role",
    ],
    [
      '<input autocomplete="nope" tabindex="-1" style="display:none">',
      "a hidden unfocusable input",
    ],
  ])("does not apply to %s (%s)", (html) => {
    expect(status(`<form>${html}</form>`, rule)).toBe(RuleStatus.Inapplicable);
  });

  it("applies to an unfocusable input that keeps a widget role", () => {
    expect(
      status(
        '<form><input autocomplete="nope" tabindex="-1" role="combobox" aria-expanded="false"></form>',
        rule,
      ),
    ).toBe(RuleStatus.Fail);
  });

  it("asks for review on a value the options ignore", () => {
    expect(status('<form><input autocomplete="text"></form>', rule)).toBe(
      RuleStatus.Incomplete,
    );
  });
});

describe("button-name", () => {
  const rule = "button-name";

  it("passes a button named by its wrapping label", () => {
    expect(status("<label>Save <button></button></label>", rule)).toBe(
      RuleStatus.Pass,
    );
  });

  it("passes a button named by a label[for]", () => {
    expect(
      status('<label for="b">Save</label><button id="b"></button>', rule),
    ).toBe(RuleStatus.Pass);
  });

  it("does not apply to a disabled button whose role needs no name", () => {
    expect(status('<button role="tab" disabled></button>', rule)).toBe(
      RuleStatus.Inapplicable,
    );
  });

  it("applies to a button whose role requires a name", () => {
    expect(
      status(
        '<div role="tree"><button role="treeitem" disabled></button></div>',
        rule,
      ),
    ).toBe(RuleStatus.Fail);
  });
});

describe("link-name", () => {
  it("fails a nameless link even when it is out of the tab order", () => {
    expect(status('<a href="/x" tabindex="-1"></a>', "link-name")).toBe(
      RuleStatus.Fail,
    );
  });
});

describe("label and select-name", () => {
  it("fails a whitespace-only placeholder", () => {
    expect(status('<input placeholder="   ">', "label")).toBe(RuleStatus.Fail);
  });

  it("passes a textarea named by its placeholder", () => {
    expect(status('<textarea placeholder="Notes"></textarea>', "label")).toBe(
      RuleStatus.Pass,
    );
  });

  it("applies to an input with an empty type attribute", () => {
    expect(status('<input type="" aria-label="Name">', "label")).toBe(
      RuleStatus.Pass,
    );
  });

  it.each(["hidden", "image", "button", "submit", "reset"])(
    "does not apply to input type=%s",
    (type) => {
      expect(status(`<input type="${type}">`, "label")).toBe(
        RuleStatus.Inapplicable,
      );
    },
  );

  // A label hidden from screen readers names nothing; the explicit-label check
  // defers to hidden-explicit-label so the failure carries that reason.
  it("fails a control whose only label is hidden", () => {
    expect(
      status(
        '<label for="q" style="display:none">Search</label><input id="q">',
        "label",
      ),
    ).toBe(RuleStatus.Fail);
  });

  it("passes a control with a hidden label and another name", () => {
    expect(
      status(
        '<label for="q" style="display:none">Search</label><input id="q" aria-label="Search">',
        "label",
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("passes a control whose label is transparent but still in the tree", () => {
    expect(
      status(
        '<label for="q" style="opacity:0">Search</label><input id="q">',
        "label",
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("fails a select whose label[for] is empty", () => {
    expect(
      status(
        '<label for="s"> </label><select id="s"><option>M</option></select>',
        "select-name",
      ),
    ).toBe(RuleStatus.Fail);
  });
});

describe("aria-dialog-name", () => {
  it("does not apply to an element that has a native naming method", () => {
    expect(
      status(
        '<fieldset role="dialog"><legend>Size</legend></fieldset>',
        "aria-dialog-name",
      ),
    ).toBe(RuleStatus.Inapplicable);
  });
});

describe("landmark-unique", () => {
  const rule = "landmark-unique";

  it("fails two sections with the same name", () => {
    expect(
      status(
        '<section aria-label="Offers">a</section><section aria-label="Offers">b</section>',
        rule,
      ),
    ).toBe(RuleStatus.Fail);
  });

  it("does not apply to an unnamed section, which is no landmark", () => {
    expect(status("<section>a</section><section>b</section>", rule)).toBe(
      RuleStatus.Inapplicable,
    );
  });

  it("passes forms with different names", () => {
    expect(
      status(
        '<form aria-label="Search"><input aria-label="q"></form><form aria-label="Newsletter"><input aria-label="e"></form>',
        rule,
      ),
    ).toBe(RuleStatus.Pass);
  });

  it("fails two unnamed search landmarks", () => {
    expect(
      status('<div role="search">a</div><div role="search">b</div>', rule),
    ).toBe(RuleStatus.Fail);
  });
});

describe("td-has-header applicability", () => {
  it("does not apply to a layout table", () => {
    expect(
      status("<table><tr><td>a</td><td>b</td></tr></table>", "td-has-header"),
    ).toBe(RuleStatus.Inapplicable);
  });

  it("does not apply to a data table smaller than three by three", () => {
    expect(
      status(
        '<table><tr><th scope="col">A</th><th scope="col">B</th></tr><tr><td>1</td><td>2</td></tr></table>',
        "td-has-header",
      ),
    ).toBe(RuleStatus.Inapplicable);
  });

  it("passes a data cell named by its own aria-label", () => {
    expect(
      status(
        "<table><caption>Sizes</caption>" +
          '<tr><td aria-label="a">1</td><td aria-label="b">2</td><td aria-label="c">3</td></tr>'.repeat(
            3,
          ) +
          "</table>",
        "td-has-header",
      ),
    ).toBe(RuleStatus.Pass);
  });
});
