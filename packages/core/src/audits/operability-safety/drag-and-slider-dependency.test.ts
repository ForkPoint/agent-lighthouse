import { describe, it, expect } from "vitest";
import { DragAndSliderDependencyAudit } from "./drag-and-slider-dependency";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import type { CheckContext } from "#core/check-context";
import {
  AuditTier,
  CheckStatus,
  EvidenceGrade,
  ScoreDisplayMode,
} from "#core/types";

/** A page at `url` carrying `body`. */
function page(body: string, url = "https://example.com/"): CheckContext {
  return mockCheckContext([
    mockPageContext(url, `<html><head></head><body>${body}</body></html>`),
  ]);
}

/** A reorderable list, whose criticality depends only on the path it sits on. */
const DRAG_LIST = `
  <ul class="items">
    <li draggable="true"><span>Seat 12A</span></li>
    <li draggable="true"><span>Seat 12B</span></li>
  </ul>`;

describe("DragAndSliderDependencyAudit", () => {
  const audit = new DragAndSliderDependencyAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("accepts a range input paired with a numeric input in the same group", async () => {
    const result = audit.audit(
      page(
        '<fieldset><label for="p">Max price</label><input id="p" type="range" min="0" max="500"><input type="number" min="0" max="500"></fieldset>',
      ),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details?.["sliders"]).toBe(0);
  });

  it("flags a lone range input and names the missing numeric input", async () => {
    const result = audit.audit(
      page(
        '<fieldset><label for="p">Max price</label><input id="p" type="range"></fieldset>',
      ),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.details?.["sliders"]).toBe(1);
    expect(result.message).toContain("numeric");
  });

  // Two different defects with two different fixes, so they are counted apart.
  it("reports a role=slider missing aria-valuenow on its own arm", async () => {
    const result = audit.audit(
      page(
        '<fieldset><div role="slider" aria-label="Max price"></div><input type="number"></fieldset>',
      ),
    );
    expect(result.details?.["sliderAria"]).toBe(1);
    expect(result.details?.["sliders"]).toBe(0);
    expect(result.message).toContain("aria-valuenow");
  });

  it("accepts a complete role=slider paired with a select", async () => {
    const result = audit.audit(
      page(
        '<fieldset><div role="slider" aria-label="Max price" aria-valuenow="100" aria-valuemin="0" aria-valuemax="500"></div><select><option>100</option></select></fieldset>',
      ),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details?.["sliderAria"]).toBe(0);
  });

  it("flags a drag-to-reorder list on a checkout path", async () => {
    const result = audit.audit(
      page(DRAG_LIST, "https://example.com/checkout/seats"),
    );
    expect(result.details?.["dragLists"]).toBe(1);
  });

  // The same markup off a task-critical path costs an agent nothing.
  it("does not flag the same list on a blog path", async () => {
    const result = audit.audit(
      page(DRAG_LIST, "https://example.com/blog/seat-tips"),
    );
    expect(result.details?.["dragLists"]).toBe(0);
  });

  it("accepts the same checkout list once move buttons are present", async () => {
    const result = audit.audit(
      page(
        '<ul class="items"><li draggable="true"><span>Seat 12A</span><button aria-label="Move up">↑</button><button aria-label="Move down">↓</button></li></ul>',
        "https://example.com/checkout/seats",
      ),
    );
    expect(result.details?.["dragLists"]).toBe(0);
  });

  it("flags a drop zone with no file input anywhere near it", async () => {
    const result = audit.audit(
      page('<div class="file-drop">Drop your CV here</div>'),
    );
    expect(result.details?.["dropZones"]).toBe(1);
    expect(result.message).toContain('input type="file"');
  });

  it("flags a carousel whose only next/prev affordance is a swipe handler", async () => {
    const result = audit.audit(
      page(
        '<div class="carousel" ontouchstart="swipe()"><div class="slide">One</div></div>',
      ),
    );
    expect(result.details?.["carousels"]).toBe(1);
  });

  it("reports a role=slider with every value but no accessible name", async () => {
    const result = audit.audit(
      page(
        '<fieldset><div role="slider" aria-valuenow="1" aria-valuemin="0" aria-valuemax="5"></div><input type="number"></fieldset>',
      ),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.details?.["sliderAria"]).toBe(1);
    expect(result.message).toContain("an accessible name");
    expect(result.message).not.toContain("aria-valuenow");
  });

  it("accepts a checkout list that offers a position select", async () => {
    const result = audit.audit(
      page(
        '<ol class="items"><li draggable="true">Item A <select aria-label="Position"><option>1</option><option>2</option></select></li></ol>',
        "https://example.com/cart",
      ),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details?.["dragLists"]).toBe(0);
  });

  it("does not count a button that is not a reorder control", async () => {
    const result = audit.audit(
      page(
        '<ul class="items"><li draggable="true">Item A <button>Delete</button></li></ul>',
        "https://example.com/checkout",
      ),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.details?.["dragLists"]).toBe(1);
  });

  it("looks beside a slider in its parent when no field group encloses it", async () => {
    const paired = audit.audit(
      page(
        '<div class="filter"><input type="range"><input inputmode="numeric"></div>',
      ),
    );
    expect(paired.status).toBe(CheckStatus.Pass);
    const apart = audit.audit(
      page('<div><input type="range"></div><div><input type="number"></div>'),
    );
    // A typed input elsewhere on the page is not bound to this slider.
    expect(apart.status).toBe(CheckStatus.Fail);
  });

  it("flags a sortable element outside any list as its own scope", async () => {
    const result = audit.audit(
      page(
        '<div class="sortable-panel"><span>Step one</span></div>',
        "https://example.com/configure",
      ),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.details?.["dragLists"]).toBe(1);
    expect(result.message).toContain("<div.sortable-panel>");
  });

  it("flags a reorderable list once, not once per item", async () => {
    const result = audit.audit(
      page(
        '<ul id="queue" role="list"><li class="draggable">A</li><li class="draggable">B</li><li class="draggable">C</li></ul>',
        "https://example.com/order/review",
      ),
    );
    expect(result.details?.["dragLists"]).toBe(1);
    expect(result.message).toContain('<ul#queue role="list">');
  });

  it("accepts a drop zone with a file input inside or beside it", async () => {
    const inside = audit.audit(
      page(
        '<div class="dropzone">Drop here <input type="file" name="cv"></div>',
      ),
    );
    expect(inside.status).toBe(CheckStatus.Pass);
    const sibling = audit.audit(
      page(
        '<div><div class="upload-area">Drop here</div><input type="file"></div>',
      ),
    );
    expect(sibling.status).toBe(CheckStatus.Pass);
    const nested = audit.audit(
      page(
        '<div><div class="file-drop">Drop here</div><label>or <input type="file"></label></div>',
      ),
    );
    expect(nested.status).toBe(CheckStatus.Pass);
  });

  it("does not flag a carousel that carries no swipe-only handler", async () => {
    const result = audit.audit(
      page('<div class="swiper"><div>One</div><div>Two</div></div>'),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details?.["carousels"]).toBe(0);
  });

  it("accepts a swipe carousel that also renders next and previous buttons", async () => {
    const result = audit.audit(
      page(
        '<div class="slick" data-swipe="true"><div>One</div><button aria-label="Previous">‹</button><button class="next-arrow"></button></div>',
      ),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("still flags a swipe carousel whose only button is not a slide control", async () => {
    const result = audit.audit(
      page(
        '<div class="flickity" onpointerdown="drag()"><button>Buy</button></div>',
      ),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.details?.["carousels"]).toBe(1);
    expect(result.message).toContain("next and previous buttons");
  });

  it("is notApplicable when the page carries none of the four constructs", async () => {
    const result = audit.audit(page('<p>Just prose.</p><a href="/x">Link</a>'));
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("registers as a scored grade-B audit", () => {
    const { meta } = DragAndSliderDependencyAudit;
    expect(meta.evidenceGrade).toBe(EvidenceGrade.B);
    expect(meta.tier).toBe(AuditTier.Scored);
    expect(meta.scoreDisplayMode).toBe(ScoreDisplayMode.Binary);
  });
});
