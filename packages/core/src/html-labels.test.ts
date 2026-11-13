import { expect, it } from "vitest";
import * as cheerio from "cheerio";
import { createExplicitLabelLookup } from "./html-labels";
import { escapeAttrValue, extractForms } from "./parser";

it("matches quoted selector results for ordinary and unusual IDs", () => {
  const $ = cheerio.load("<form><input></form>");
  const ids = [
    "field",
    ":r0:",
    "dots.name",
    "1-field",
    'quote"and\\slash',
    "Име",
    "bracket]id",
  ];
  for (const id of ids) {
    for (let i = 0; i < 2; i++)
      $("body").append($("<label>").attr("for", id).text(`${id}:${i}`));
  }
  const lookup = createExplicitLabelLookup($);
  for (const id of ids)
    expect(lookup(id)?.toArray()).toEqual(
      $(`label[for="${escapeAttrValue(id)}"]`).toArray(),
    );
  expect(lookup(undefined)).toBeUndefined();
  expect(lookup("")).toBeUndefined();
  expect(lookup("missing")).toBeUndefined();
});

it("scans the document once for a complete pass over ordinary field IDs", () => {
  const $ = cheerio.load(
    Array.from(
      { length: 100 },
      (_, i) => `<label for="field-${i}">Label ${i}</label>`,
    ).join(""),
  );
  const selectors: string[] = [];
  const observed = new Proxy($, {
    apply(target, receiver, args) {
      if (typeof args[0] === "string") selectors.push(args[0]);
      return Reflect.apply(target, receiver, args);
    },
  });
  const lookup = createExplicitLabelLookup(observed);
  for (let i = 0; i < 100; i++)
    expect(lookup(`field-${i}`)?.text()).toBe(`Label ${i}`);
  expect(
    selectors.filter((selector) => selector === "label[for]"),
  ).toHaveLength(1);
  expect(
    selectors.filter((selector) => selector.startsWith('label[for="')),
  ).toHaveLength(0);
});

it("keeps all-label parser text and document-wide label scope", () => {
  const $ = cheerio.load(
    '<label for="field">First</label><form><input id="field" name="field"></form><label for="field">Second</label>',
  );
  expect(extractForms($)[0]?.inputs[0]?.label).toBe("FirstSecond");
  expect(createExplicitLabelLookup($)("field")?.first().text()).toBe("First");
});

it("refreshes lookups across later passes over an edited DOM", () => {
  const $ = cheerio.load(
    '<label for="x">Before</label><form><input id="x" name="field"></form>',
  );
  expect(extractForms($)[0]?.inputs[0]?.label).toBe("Before");
  $("label").attr("for", "y").text("After");
  expect(extractForms($)[0]?.inputs[0]?.label).toBeUndefined();
  expect(createExplicitLabelLookup($)("y")?.text()).toBe("After");
});
