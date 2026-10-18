import { describe, it, expect } from "vitest";
import { A2aAgentCardAudit } from "./a2a-agent-card";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";
import { AuditResultSchema } from "#core/schemas";
import { CheckStatus } from "#core/types";

/** An A2A 1.0 §4.4.1 card with every Required field. */
function card(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Booking Agent",
    description: "Books tables at the restaurant.",
    version: "1.2.0",
    supportedInterfaces: [
      { url: "https://example.com/a2a", protocolBinding: "JSONRPC" },
    ],
    capabilities: { streaming: true },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [{ id: "book", name: "Book a table", description: "Books" }],
    ...over,
  };
}

const at = (path: string, body: string, status = 200) =>
  mockCheckContext([], {
    [path]: mockFetchResult(body, status, "application/json"),
  });

const withCard = (body: Record<string, unknown> | string) =>
  at(
    "/.well-known/agent-card.json",
    typeof body === "string" ? body : JSON.stringify(body),
  );

describe("A2aAgentCardAudit", () => {
  const audit = new A2aAgentCardAudit();

  it("passes a complete A2A 1.0 card", () => {
    const result = audit.audit(withCard(card()));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(AuditResultSchema.safeParse(result).success).toBe(true);
  });

  // ── Absent ──

  it("is not applicable when neither path is published", () => {
    const result = audit.audit(mockCheckContext([], {}));
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("is not applicable on a 404", () => {
    const result = audit.audit(
      at("/.well-known/agent-card.json", "Not found", 404),
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("treats an HTML 200 stand-in as absent", () => {
    const result = audit.audit(
      withCard("<!doctype html><html><body>Home</body></html>"),
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("does not read a non-A2A JSON file at the legacy path as a card", () => {
    const result = audit.audit(
      at("/.well-known/agent.json", JSON.stringify({ name: "x", foo: 1 })),
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  // ── Broken ──

  it("fails a card that does not parse as JSON", () => {
    const result = audit.audit(withCard("{ name: oops"));
    expect(result.status).toBe(CheckStatus.Fail);
  });

  it("fails a card that is a JSON array", () => {
    const result = audit.audit(withCard("[1,2]"));
    expect(result.status).toBe(CheckStatus.Fail);
  });

  it("fails capabilities sent as an array", () => {
    const result = audit.audit(withCard(card({ capabilities: ["streaming"] })));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("capabilities");
  });

  it("fails skills that is not an array", () => {
    const result = audit.audit(withCard(card({ skills: { id: "book" } })));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("skills");
  });

  it("fails supportedInterfaces that is not an array", () => {
    const result = audit.audit(
      withCard(card({ supportedInterfaces: "https://example.com/a2a" })),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("supportedInterfaces");
  });

  // ── Readable but incomplete ──

  it("warns on missing Required fields, naming name and description first", () => {
    const body = card();
    delete body["name"];
    delete body["version"];
    const result = audit.audit(withCard(body));
    expect(result.status).toBe(CheckStatus.Warn);
    const message = result.message ?? "";
    expect(message.indexOf("name")).toBeLessThan(message.indexOf("version"));
  });

  it("warns on a 0.3-shape card (top-level url, no supportedInterfaces)", () => {
    const body = card({
      url: "https://example.com/a2a",
      preferredTransport: "JSONRPC",
      protocolVersion: "0.3.0",
    });
    delete body["supportedInterfaces"];
    const result = audit.audit(withCard(body));
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("0.3");
  });

  it("warns on an interface URL that is not absolute https", () => {
    const result = audit.audit(
      withCard(
        card({
          supportedInterfaces: [
            { url: "http://example.com/a2a", protocolBinding: "JSONRPC" },
          ],
        }),
      ),
    );
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("https");
  });

  it("accepts a wss interface URL, which the spec's own examples use", () => {
    const result = audit.audit(
      withCard(
        card({
          supportedInterfaces: [
            { url: "wss://example.com/a2a/ws", protocolBinding: "websocket" },
          ],
        }),
      ),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("warns when the card sits only at the legacy agent.json path", () => {
    const result = audit.audit(
      at("/.well-known/agent.json", JSON.stringify(card())),
    );
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("agent-card.json");
  });

  it("prefers agent-card.json when both paths are published", () => {
    const ctx = mockCheckContext([], {
      "/.well-known/agent-card.json": mockFetchResult(
        JSON.stringify(card()),
        200,
        "application/json",
      ),
      "/.well-known/agent.json": mockFetchResult("{}", 200, "application/json"),
    });
    expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
  });

  it("reports whether the card is signed as a scalar detail", () => {
    const result = audit.audit(
      withCard(card({ signatures: [{ protected: "x", signature: "y" }] })),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(AuditResultSchema.safeParse(result).success).toBe(true);
    expect(result.details?.["signed"]).toBe(true);
  });
});
