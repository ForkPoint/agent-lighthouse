import { describe, it, expect } from "vitest";
import { defaultConfig } from "#core/audit-config";
import { planAudits } from "#core/audit-runner";
import { GhostClickableElementRatioAudit } from "./ghost-clickable-element-ratio";
import {
  mockCheckContext,
  mockPageContext,
  walledSiteContext,
} from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import type { CheckContext } from "#core/check-context";
import { AuditTier, CheckStatus, EvidenceGrade } from "#core/types";

/** A homepage carrying `body`, with an optional inline stylesheet. */
function page(body: string, css = ""): CheckContext {
  const style = css ? `<style>${css}</style>` : "";
  return mockCheckContext([
    mockPageContext(
      "https://example.com/",
      `<html><head>${style}</head><body>${body}</body></html>`,
    ),
  ]);
}

/** N semantic buttons, to move the ratio without changing what is under test. */
const semantic = (n: number) =>
  Array.from({ length: n }, (_v, i) => `<button>Action ${i}</button>`).join("");

it.each(["presentation", "none", "img", "status"])(
  "does not treat a nested %s role as a control",
  async (role) => {
    const result = await new GhostClickableElementRatioAudit().audit(
      page(
        `${semantic(3)}<div class="btn-primary"><span role="${role}" aria-label="Buy icon">Buy now</span></div>`,
      ),
    );
    expect(result.details?.["ghostCount"]).toBe(1);
  },
);

it("keeps an inner element's independent inline action", async () => {
  const result = await new GhostClickableElementRatioAudit().audit(
    page(
      '<button>Open cart <span onclick="event.stopPropagation();removeItem()">Remove item</span></button>',
    ),
  );
  expect(result.details?.["ghostCount"]).toBe(1);
});

it.each([
  '<a href="/p/1"><img onclick="ga(\'send\',\'event\')" src="x.png" alt="Mug"></a>',
  '<button><span onmousedown="track()">Buy</span></button>',
])("keeps an observing inline handler inside its control: %s", async (html) => {
  const result = await new GhostClickableElementRatioAudit().audit(page(html));
  expect(result.details?.["ghostCount"]).toBe(0);
});

it.each([
  'role="Button"',
  'role="link button"',
  'role="gridcell"',
  'role="scrollbar"',
])("exempts a wrapper around %s", async (role) => {
  const result = await new GhostClickableElementRatioAudit().audit(
    page(
      `<div class="btn-cta"><span ${role} tabindex="0">Buy now</span></div>`,
    ),
  );
  expect(result.details?.["ghostCount"]).toBe(0);
});

it("resolves the first recognized role, not any fallback token", async () => {
  const result = await new GhostClickableElementRatioAudit().audit(
    page(
      '<button>Help</button><div class="btn-primary"><span role="img button" aria-label="Buy icon">Buy now</span></div>',
    ),
  );
  expect(result.details?.["ghostCount"]).toBe(1);
});

it("skips an unknown first role token for the next one", async () => {
  const result = await new GhostClickableElementRatioAudit().audit(
    page(
      '<div class="btn-primary"><span role="fancy-button button" tabindex="0">Buy now</span></div>',
    ),
  );
  expect(result.details?.["ghostCount"]).toBe(0);
});

it("still exempts a wrapper around an ARIA button", async () => {
  const result = await new GhostClickableElementRatioAudit().audit(
    page(
      '<div class="btn-primary"><span role="button" tabindex="0">Buy now</span></div>',
    ),
  );
  expect(result.details?.["ghostCount"]).toBe(0);
});

describe("GhostClickableElementRatioAudit", () => {
  const audit = new GhostClickableElementRatioAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("passes a page of native buttons at ratio 1.0", async () => {
    const result = await audit.audit(page(semantic(5)));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("1.00");
  });

  it("counts a div with an inline click handler as a ghost", async () => {
    const result = await audit.audit(
      page(`${semantic(3)}<div onclick="go()">Add to cart</div>`),
    );
    expect(result.found).toContain("ghost");
    expect(result.details?.["ghostCount"]).toBe(1);
  });

  // The class vocabulary alone is enough: no listener, no stylesheet.
  it("counts a div whose class advertises a button as a ghost", async () => {
    const result = await audit.audit(
      page(`${semantic(3)}<div class="btn-primary">Buy</div>`),
    );
    expect(result.details?.["ghostCount"]).toBe(1);
  });

  // A wrapper named for a call to action, whose action is a nested native
  // link, is layout. The link is the control, and the snapshot carries it.
  it("does not count a class-named wrapper around a native link", async () => {
    const result = await audit.audit(
      page(
        `${semantic(3)}<div class="install-cta"><a href="/install/">Install</a></div>`,
      ),
    );
    expect(result.details?.["ghostCount"]).toBe(0);
  });

  it("does not count a cursor-styled card wrapping a button", async () => {
    const result = await audit.audit(
      page(
        `${semantic(3)}<div class="promo"><p>Spring sale</p><button>Shop</button></div>`,
        ".promo { cursor: pointer }",
      ),
    );
    expect(result.details?.["ghostCount"]).toBe(0);
  });

  // The icon and label inside a link are the link, not controls of their own.
  it("does not count a click-named icon or label inside a link", async () => {
    const result = await audit.audit(
      page(
        `${semantic(3)}<div class="live-cta"><a href="/live"><div class="cta-icon">▶</div><span class="cta-title">Live</span></a></div>`,
      ),
    );
    expect(result.details?.["ghostCount"]).toBe(0);
  });

  // An inline handler is the wrapper's own action, whatever it contains.
  it("still counts a wrapper with its own inline click handler", async () => {
    const result = await audit.audit(
      page(
        `${semantic(3)}<div class="install-cta" onclick="install()">Install <a href="/help/">Help</a></div>`,
      ),
    );
    expect(result.details?.["ghostCount"]).toBe(1);
  });

  it("counts a div made clickable only by a stylesheet cursor rule", async () => {
    const result = await audit.audit(
      page(
        `${semantic(3)}<div class="promo">Buy</div>`,
        ".promo { cursor: pointer }",
      ),
    );
    expect(result.details?.["ghostCount"]).toBe(1);
  });

  it("does not count the same div once it carries a role and a name", async () => {
    const result = await audit.audit(
      page(
        `${semantic(3)}<div role="button" class="promo">Buy</div>`,
        ".promo { cursor: pointer }",
      ),
    );
    expect(result.details?.["ghostCount"]).toBe(0);
  });

  it("counts an anchor with no href as a ghost and says why", async () => {
    const result = await audit.audit(page(`${semantic(3)}<a>Products</a>`));
    expect(result.details?.["ghostCount"]).toBe(1);
    expect(result.found).toContain("no href");
  });

  // Two distinct defects, two distinct remediations, so `found` keeps them apart.
  it("separates the empty-name arm from the click-signal arm", async () => {
    const result = await audit.audit(
      page(`${semantic(3)}<button><svg></svg></button>`),
    );
    expect(result.details?.["ghostCount"]).toBe(1);
    expect(result.found).toContain("no accessible name");
  });

  it("fails below a ratio of 0.9 and warns at exactly 0.9", async () => {
    // 1 ghost of 10 targets -> 0.90 exactly.
    const atBoundary = await audit.audit(
      page(`${semantic(9)}<div onclick="go()">x</div>`),
    );
    expect(atBoundary.status).toBe(CheckStatus.Warn);
    // 2 ghosts of 10 -> 0.80.
    const below = await audit.audit(
      page(
        `${semantic(8)}<div onclick="go()">x</div><div onclick="go()">y</div>`,
      ),
    );
    expect(below.status).toBe(CheckStatus.Fail);
  });

  it("is notApplicable when the page carries no click target of either kind", async () => {
    const result = await audit.audit(page("<p>Just prose.</p>"));
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  // The CDP tier in the sketch needs a live browser. The audit must not claim it.
  it("does not promise the headless CDP tier in its description", () => {
    const { meta } = GhostClickableElementRatioAudit;
    expect(meta.description).not.toContain("CDP");
    expect(meta.evidenceGrade).toBe(EvidenceGrade.B);
    expect(meta.tier).toBe(AuditTier.Scored);
    expect(meta.weight).toBeCloseTo(0.6);
  });

  // A bot wall does not have to answer with an error status. A Cloudflare
  // managed challenge is served at 200 `text/html` from the requested host,
  // and its one `role="main"` wrapper is a semantic click target — enough for
  // the survey to report a ratio of 1.00 and pass Cloudflare's markup as the
  // site's.
  it("declines when no response can be attributed to this site", async () => {
    const plan = planAudits(walledSiteContext(), defaultConfig);
    const result = plan.skipped.find(
      (stub) => stub.id === GhostClickableElementRatioAudit.meta.id,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      GhostClickableElementRatioAudit.meta.id,
    );
    expect(result?.status).toBe(CheckStatus.NotApplicable);
    expect(result?.explanation).toMatch(/^Not assessed: /);
  });
});
