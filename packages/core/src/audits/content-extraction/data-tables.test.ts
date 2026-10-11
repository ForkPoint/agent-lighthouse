import { describe, it, expect } from "vitest";
import { defaultConfig } from "#core/audit-config";
import { planAudits } from "#core/audit-runner";
import { DataTablesAudit } from "./data-tables";
import {
  attributableFixture,
  mockCheckContext,
  shellSiteContext,
  mockPageContext,
  unreachedSiteContext,
} from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

describe("DataTablesAudit", () => {
  const audit = new DataTablesAudit();

  it("passes (not applicable) when there are no tables", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><p>No tables</p></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("No data tables found");
  });

  it("passes when all tables have <thead> and <th>", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body><table>
        <thead><tr><th scope="col">Feature</th><th scope="col">Value</th></tr></thead>
        <tbody><tr><td>Speed</td><td>100ms</td></tr></tbody>
      </table></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("1/1");
  });

  it("warns when a majority but not all tables are structured", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body>
        <table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>
        <table><tbody><tr><th>RowHdr</th><td>2</td></tr></tbody></table>
        <table><tbody><tr><td>plain</td></tr></tbody></table>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("2/3");
  });

  it("fails when no table has proper header structure", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><table><tbody><tr><td>plain</td></tr></tbody></table></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("0/1");
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new DataTablesAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe(
      CheckStatus.NotApplicable,
    );

    const plan = planAudits(
      unreachedSiteContext(pages, rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      DataTablesAudit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === DataTablesAudit.meta.id)?.status,
    ).toBe(CheckStatus.NotApplicable);
  });

  // A JS shell serves a head and an empty body. No table arrived, so "no data
  // tables" would be the scan reporting its own silence as the page's shape.
  it("declines a page that served no readable text", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new DataTablesAudit();
    const rendered = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(rendered.status, "the same input rendered is judged").not.toBe(
      CheckStatus.NotApplicable,
    );

    const shell = await instance.audit(shellSiteContext());
    expect(shell.status).toBe(CheckStatus.NotApplicable);
  });
});
