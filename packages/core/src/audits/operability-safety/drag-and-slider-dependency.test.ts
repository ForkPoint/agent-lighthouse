import { describe, it, expect } from "vitest";
import { DragAndSliderDependencyAudit } from "./drag-and-slider-dependency";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { CheckContext } from "../../check-context";

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
    const result = await audit.audit(
      page(
        '<fieldset><label for="p">Max price</label><input id="p" type="range" min="0" max="500"><input type="number" min="0" max="500"></fieldset>',
      ),
    );
    expect(result.status).toBe("pass");
    expect(result.details?.["sliders"]).toBe(0);
  });

  it("flags a lone range input and names the missing numeric input", async () => {
    const result = await audit.audit(
      page(
        '<fieldset><label for="p">Max price</label><input id="p" type="range"></fieldset>',
      ),
    );
    expect(result.status).toBe("fail");
    expect(result.details?.["sliders"]).toBe(1);
    expect(result.message).toContain("numeric");
  });

  // Two different defects with two different fixes, so they are counted apart.
  it("reports a role=slider missing aria-valuenow on its own arm", async () => {
    const result = await audit.audit(
      page(
        '<fieldset><div role="slider" aria-label="Max price"></div><input type="number"></fieldset>',
      ),
    );
    expect(result.details?.["sliderAria"]).toBe(1);
    expect(result.details?.["sliders"]).toBe(0);
    expect(result.message).toContain("aria-valuenow");
  });

  it("accepts a complete role=slider paired with a select", async () => {
    const result = await audit.audit(
      page(
        '<fieldset><div role="slider" aria-label="Max price" aria-valuenow="100" aria-valuemin="0" aria-valuemax="500"></div><select><option>100</option></select></fieldset>',
      ),
    );
    expect(result.status).toBe("pass");
    expect(result.details?.["sliderAria"]).toBe(0);
  });

  it("flags a drag-to-reorder list on a checkout path", async () => {
    const result = await audit.audit(
      page(DRAG_LIST, "https://example.com/checkout/seats"),
    );
    expect(result.details?.["dragLists"]).toBe(1);
  });

  // The same markup off a task-critical path costs an agent nothing.
  it("does not flag the same list on a blog path", async () => {
    const result = await audit.audit(
      page(DRAG_LIST, "https://example.com/blog/seat-tips"),
    );
    expect(result.details?.["dragLists"]).toBe(0);
  });

  it("accepts the same checkout list once move buttons are present", async () => {
    const result = await audit.audit(
      page(
        '<ul class="items"><li draggable="true"><span>Seat 12A</span><button aria-label="Move up">↑</button><button aria-label="Move down">↓</button></li></ul>',
        "https://example.com/checkout/seats",
      ),
    );
    expect(result.details?.["dragLists"]).toBe(0);
  });

  it("flags a drop zone with no file input anywhere near it", async () => {
    const result = await audit.audit(
      page('<div class="file-drop">Drop your CV here</div>'),
    );
    expect(result.details?.["dropZones"]).toBe(1);
    expect(result.message).toContain('input type="file"');
  });

  it("flags a carousel whose only next/prev affordance is a swipe handler", async () => {
    const result = await audit.audit(
      page(
        '<div class="carousel" ontouchstart="swipe()"><div class="slide">One</div></div>',
      ),
    );
    expect(result.details?.["carousels"]).toBe(1);
  });

  it("is notApplicable when the page carries none of the four constructs", async () => {
    const result = await audit.audit(
      page('<p>Just prose.</p><a href="/x">Link</a>'),
    );
    expect(result.status).toBe("na");
  });

  it("registers as a scored grade-B audit", () => {
    const { meta } = DragAndSliderDependencyAudit;
    expect(meta.evidenceGrade).toBe("B");
    expect(meta.tier).toBe("scored");
    expect(meta.scoreDisplayMode).toBe("binary");
  });
});
