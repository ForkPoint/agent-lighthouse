import { afterEach, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { checks, CheckBuilder, setDocument } from "./checks";
import { escapeSelector, toVNode } from "./core";
import { runRules, RuleStatus } from "./rules";
import { CheckStatus } from "#core/types";

afterEach(() => vi.restoreAllMocks());

function evaluate(check: string, node: Element) {
  const builder = new CheckBuilder();
  const value = checks[check]!.evaluate.call(builder, node, {}, toVNode(node));
  return { builder, value };
}

it("bounds document-wide ID and label searches for a complete fixed-DOM pass", () => {
  const doc = new JSDOM(
    Array.from(
      { length: 60 },
      (_, i) =>
        `<label for="field-${i}">Field ${i}</label><input id="field-${i}">`,
    ).join(""),
  ).window.document;
  setDocument(doc);
  const query = vi.spyOn(doc, "querySelectorAll");
  for (const node of doc.querySelectorAll("input")) {
    expect(evaluate("duplicate-id-aria", node).value).toBe(true);
    expect(evaluate("explicit-label", node).value).toBe(true);
    expect(evaluate("hidden-explicit-label", node).value).toBe(false);
  }
  expect(
    query.mock.calls.filter(([selector]) => selector === "[id]"),
  ).toHaveLength(1);
  expect(
    query.mock.calls.filter(([selector]) => selector === "label[for]"),
  ).toHaveLength(1);
  expect(
    query.mock.calls.filter(
      ([selector]) =>
        selector.startsWith('[id="') || selector.startsWith('label[for="'),
    ),
  ).toHaveLength(0);
});

it("preserves duplicate-ID matching for exact, trimmed and unusual IDs", () => {
  const doc = new JSDOM("").window.document;
  const ids = [
    "target",
    "target",
    ":r0:",
    "dots.name",
    'quoted"id',
    'quoted"id',
    "line\nbreak",
    "line\nbreak",
    "Име",
    "Име",
    " target ",
    "",
    "1field",
  ];
  const nodes = ids.map((id) => {
    const node = doc.createElement("span");
    node.id = id;
    doc.body.append(node);
    return node;
  });
  setDocument(doc);
  for (const node of nodes) {
    const id = node.id.trim();
    const expected = id
      ? Array.from(doc.querySelectorAll(`[id="${escapeSelector(id)}"]`)).filter(
          (other) => other !== node,
        )
      : [];
    const { value, builder } = evaluate("duplicate-id-aria", node);
    expect(value).toBe(expected.length === 0);
    expect(builder._related).toEqual(expected);
  }
});

it("preserves label order and unusual attribute values", () => {
  const doc = new JSDOM("").window.document;
  const controls = ["field", ":r0:", 'quote"id', "line\nbreak", "Име"].map(
    (id) => {
      const input = doc.createElement("input");
      input.id = id;
      for (let i = 0; i < 2; i++) {
        const label = doc.createElement("label");
        label.setAttribute("for", id);
        label.textContent = `Label ${i}`;
        doc.body.append(label);
      }
      doc.body.append(input);
      return input;
    },
  );
  setDocument(doc);
  for (const input of controls) {
    const expected = Array.from(
      doc.querySelectorAll(`label[for="${escapeSelector(input.id)}"]`),
    );
    const { builder } = evaluate("explicit-label", input);
    expect(builder._related).toEqual(expected);
  }
});

it("rebuilds the index between runs on the same edited document", () => {
  const doc = new JSDOM(
    '<span id="x">a</span><span id="x">b</span><button aria-labelledby="x">Go</button>',
  ).window.document;
  expect(
    runRules(doc, ["duplicate-id-aria"])["duplicate-id-aria"]?.status,
  ).toBe(RuleStatus.Incomplete);
  doc.querySelectorAll("span")[1]!.id = "y";
  expect(
    runRules(doc, ["duplicate-id-aria"])["duplicate-id-aria"]?.status,
  ).toBe(CheckStatus.Pass);
  doc.querySelectorAll("span")[1]!.id = "x";
  expect(
    runRules(doc, ["duplicate-id-aria"])["duplicate-id-aria"]?.status,
  ).toBe(RuleStatus.Incomplete);
});

it("retains first-label behavior after document order changes between runs", () => {
  const doc = new JSDOM(
    '<label for="x" hidden></label><label for="x"></label><input id="x">',
  ).window.document;
  const input = doc.querySelector("input")!;
  setDocument(doc);
  expect(evaluate("hidden-explicit-label", input).value).toBe(true);
  doc.body.prepend(doc.querySelectorAll("label")[1]!);
  setDocument(doc);
  expect(evaluate("hidden-explicit-label", input).value).toBe(false);
});
