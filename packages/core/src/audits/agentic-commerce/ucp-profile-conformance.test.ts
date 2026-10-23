import { describe, expect, it } from "vitest";
import { AuditResultSchema } from "#core/schemas";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";
import { UcpProfileConformanceAudit } from "./ucp-profile-conformance";

function context(profile: unknown) {
  return mockCheckContext([], {
    "/.well-known/ucp": mockFetchResult(
      JSON.stringify(profile),
      200,
      "application/json",
    ),
  });
}

function modern(version = "2026-08-25") {
  return {
    ucp: {
      version,
      capabilities: {
        "dev.ucp.shopping.checkout": [
          {
            version: "2026-04-08",
            schema: "https://ucp.dev/2026-04-08/schemas/shopping/checkout.json",
          },
        ],
      },
      payment_handlers: {
        "com.example.pay": [{ id: "processor", version: "2026-01-23" }],
      },
    },
  };
}

function legacy() {
  return {
    ucp: {
      version: "2026-01-11",
      capabilities: [
        {
          name: "dev.ucp.shopping.checkout",
          version: "2026-01-11",
          spec: "https://ucp.dev/2026-01-11/specification/checkout",
          schema: "https://ucp.dev/2026-01-11/schemas/shopping/checkout.json",
        },
      ],
    },
    payment: {
      handlers: [
        {
          id: "processor",
          name: "com.example.pay",
          version: "2026-01-11",
          spec: "https://example.com/payment/spec",
          config_schema: "https://example.com/payment/config.json",
          instrument_schemas: ["https://example.com/payment/instrument.json"],
          config: {},
        },
      ],
    },
  };
}

describe("UcpProfileConformanceAudit", () => {
  const audit = new UcpProfileConformanceAudit();

  it.each([
    "com.example-shop.checkout",
    "com.2example.cart",
    "xn--p1ai.example.checkout",
  ])(
    "uses the 2026-08-25 reverse-domain pattern for registry keys and parents: %s",
    (name) => {
      const current = {
        ucp: {
          version: "2026-08-25",
          capabilities: {
            [name]: [
              {
                version: "2026-08-25",
                schema: "urn:example:capability",
                extends: name,
              },
            ],
            "com.example.extension": [
              {
                version: "2026-08-25",
                schema: "urn:example:extension",
                extends: [name],
              },
            ],
          },
          payment_handlers: { [name]: [{ id: "pay", version: "2026-08-25" }] },
        },
      };
      const result = audit.audit(context(current));
      expect(result.status).toBe(CheckStatus.Pass);
      expect(result.details).toMatchObject({
        validCapabilities: 2,
        validPaymentHandlers: 1,
      });
      current.ucp.version = "2026-04-08";
      expect(audit.audit(context(current)).status).toBe(CheckStatus.Fail);
    },
  );

  it.each([
    "com.-example.checkout",
    "com.example-.checkout",
    "com._example.checkout",
  ])(
    "does not loosen the current reverse-domain rules beyond the schema: %s",
    (name) => {
      const body = {
        ucp: {
          version: "2026-08-25",
          capabilities: {
            [name]: [
              { version: "2026-08-25", schema: "urn:example:capability" },
            ],
          },
          payment_handlers: {},
        },
      };
      const result = audit.audit(context(body));
      expect(result.status).toBe(CheckStatus.Fail);
      expect(result.details?.["validCapabilities"]).toBe(0);
    },
  );

  it("permits unknown legacy capability id and unknown legacy handler schema fields", () => {
    const body = legacy();
    Object.assign(body.ucp.capabilities[0]!, { id: 123 });
    Object.assign(body.payment.handlers[0]!, { schema: {} });
    const result = audit.audit(context(body));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details).toMatchObject({
      validCapabilities: 1,
      validPaymentHandlers: 1,
    });
    expect(AuditResultSchema.safeParse(result).success).toBe(true);
  });

  it.each(["https://example.com/%GG", String.raw`https://example.com\path`])(
    "rejects malformed JSON Schema URI syntax that WHATWG parsers normalize: %s",
    (uri) => {
      const body = modern();
      body.ucp.capabilities["dev.ucp.shopping.checkout"][0]!.schema = uri;
      const result = audit.audit(context(body));
      expect(result.status).toBe(CheckStatus.Fail);
      expect(result.details?.["issueCount"]).toBe(1);
      const old = legacy();
      old.payment.handlers[0]!.instrument_schemas = [uri];
      expect(audit.audit(context(old)).status).toBe(CheckStatus.Fail);
    },
  );

  it("accepts correctly escaped URI characters and non-HTTP absolute URIs", () => {
    const body = modern();
    body.ucp.capabilities["dev.ucp.shopping.checkout"][0]!.schema =
      "https://example.com/%20";
    expect(audit.audit(context(body)).status).toBe(CheckStatus.Pass);
    body.ucp.capabilities["dev.ucp.shopping.checkout"][0]!.schema =
      "urn:example:capability";
    expect(audit.audit(context(body)).status).toBe(CheckStatus.Pass);
  });

  it("declines absent profiles and unrelated well-known JSON", () => {
    expect(audit.audit(mockCheckContext([], {})).status).toBe(
      CheckStatus.NotApplicable,
    );
    expect(audit.audit(context({ other: true })).status).toBe(
      CheckStatus.NotApplicable,
    );
  });

  it("leaves unreadable profile findings to ucp-profile", () => {
    const result = audit.audit(context({ ucp: null }));
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("ucp-profile");
  });

  it.each([undefined, "2027-01-01", 42])(
    "does not claim conformance for an unsupported version %s",
    (version) => {
      const result = audit.audit(context({ ucp: { version } }));
      expect(result.status).toBe(CheckStatus.Warn);
      expect(result.details?.["validationPerformed"]).toBe(false);
      expect(AuditResultSchema.safeParse(result).success).toBe(true);
    },
  );

  it.each(["2026-04-08", "2026-08-25"])(
    "passes business declarations for %s without optional spec URLs",
    (version) => {
      const result = audit.audit(context(modern(version)));
      expect(result.status).toBe(CheckStatus.Pass);
      expect(result.details).toMatchObject({
        validCapabilities: 1,
        validPaymentHandlers: 1,
      });
      expect(AuditResultSchema.safeParse(result).success).toBe(true);
    },
  );

  it("does not require optional capabilities or an available-instrument declaration", () => {
    const result = audit.audit(
      context({ ucp: { version: "2026-08-25", payment_handlers: {} } }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details).toMatchObject({
      capabilities: 0,
      paymentHandlers: 0,
    });
  });

  it("requires the modern business-profile payment-handler registry, even when empty", () => {
    const result = audit.audit(context({ ucp: { version: "2026-04-08" } }));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.details?.["issues"]).toContain(
      "ucp.payment_handlers: must be a registry object",
    );
  });

  it("permits 2026-04-08 business capabilities without schema but requires it in 2026-08-25", () => {
    const body = (version: string) => ({
      ucp: {
        version,
        capabilities: {
          "dev.ucp.shopping.checkout": [{ version: "2026-04-08" }],
        },
        payment_handlers: {},
      },
    });
    expect(audit.audit(context(body("2026-04-08"))).status).toBe(
      CheckStatus.Pass,
    );
    expect(audit.audit(context(body("2026-08-25"))).status).toBe(
      CheckStatus.Fail,
    );
  });

  it("does not force independently versioned components to match the profile version", () => {
    expect(audit.audit(context(modern())).status).toBe(CheckStatus.Pass);
  });

  it("does not fetch URI fields or impose HTTPS where the schema only requires an absolute URI", () => {
    const result = audit.audit(
      context({
        ucp: {
          version: "2026-08-25",
          capabilities: {
            "com.example.custom": [
              {
                version: "2026-08-25",
                schema: "urn:example:capability",
                spec: "http://example.com/spec",
              },
            ],
          },
          payment_handlers: {},
        },
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("reports wrong registry shapes and retains good declarations beside malformed ones", () => {
    const result = audit.audit(
      context({
        ucp: {
          version: "2026-08-25",
          capabilities: {
            "dev.ucp.shopping.checkout": [
              null,
              { version: "2026-08-25", schema: "https://example.com/schema" },
            ],
            "invalid-key": {},
          },
          payment_handlers: {
            "com.example.pay": [
              { id: "one", version: "2026-08-25" },
              { version: "2026-08-25" },
            ],
          },
        },
      }),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.details).toMatchObject({
      capabilities: 2,
      validCapabilities: 1,
      paymentHandlers: 2,
      validPaymentHandlers: 1,
    });
    expect(AuditResultSchema.safeParse(result).success).toBe(true);
  });

  it("validates declared optional URI, config, id and parent field types", () => {
    const result = audit.audit(
      context({
        ucp: {
          version: "2026-04-08",
          capabilities: {
            "dev.ucp.shopping.checkout": [
              {
                version: "bad",
                spec: "/relative",
                schema: 1,
                config: [],
                id: 2,
                extends: [],
              },
            ],
          },
          payment_handlers: {},
        },
      }),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.details?.["issueCount"]).toBe(6);
  });

  it("accepts one or multiple modern extension parents and rejects malformed names", () => {
    const body = (extendsValue: unknown) => ({
      ucp: {
        version: "2026-04-08",
        capabilities: {
          "dev.ucp.shopping.fulfillment": [
            { version: "2026-04-08", extends: extendsValue },
          ],
        },
        payment_handlers: {},
      },
    });
    expect(audit.audit(context(body("dev.ucp.shopping.checkout"))).status).toBe(
      CheckStatus.Pass,
    );
    expect(
      audit.audit(
        context(body(["dev.ucp.shopping.checkout", "dev.ucp.shopping.cart"])),
      ).status,
    ).toBe(CheckStatus.Pass);
    expect(audit.audit(context(body(["bad"]))).status).toBe(CheckStatus.Fail);
  });

  it("checks modern available-instrument declaration types", () => {
    const result = audit.audit(
      context({
        ucp: {
          version: "2026-04-08",
          payment_handlers: {
            "com.example.pay": [
              {
                id: "one",
                version: "2026-04-08",
                available_instruments: [
                  null,
                  {},
                  { type: "card", constraints: {} },
                ],
              },
            ],
          },
        },
      }),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.details?.["issueCount"]).toBe(3);
  });

  it("does not reject open instrument type names", () => {
    const result = audit.audit(
      context({
        ucp: {
          version: "2026-08-25",
          payment_handlers: {
            "com.example.pay": [
              {
                id: "one",
                version: "2026-04-08",
                available_instruments: [{ type: "custom_instrument" }],
              },
            ],
          },
        },
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  function constraintProfile(constraints: unknown, version = "2026-08-25") {
    return {
      ucp: {
        version,
        payment_handlers: {
          "com.example.pay": [
            {
              id: "processor",
              // The profile schema controls shape, not the component date.
              version: "2026-04-08",
              available_instruments: [{ type: "vendor_card", constraints }],
            },
          ],
        },
      },
    };
  }

  it.each([
    {},
    { required: ["network", "currency"] },
    { properties: { network: { enum: ["visa", "mastercard"] } } },
    { properties: { token: { const: null } } },
    { properties: { token: { const: { custom: [1, true] } } } },
    { properties: { network: { enum: ["visa"], const: "visa" } } },
    {
      properties: {
        billing: {
          required: ["country"],
          properties: { country: { const: "US" } },
        },
      },
    },
    { properties: { extension: {} } },
    {
      anyOf: [
        { required: ["network"] },
        { properties: { country: { enum: ["US"] } } },
      ],
    },
  ])("accepts published nested constraint forms: %j", (constraints) => {
    const result = audit.audit(context(constraintProfile(constraints)));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details?.["validPaymentHandlers"]).toBe(1);
    expect(result.details?.["constraintValidationLimited"]).toBe(false);
    expect(() => AuditResultSchema.parse(result)).not.toThrow();
  });

  it.each([
    { required: [] },
    { required: ["network", "network"] },
    { required: [1] },
    { properties: {} },
    { properties: { network: "visa" } },
    { properties: { network: { enum: [] } } },
    { properties: { network: { enum: ["visa", "visa"] } } },
    {
      properties: {
        network: {
          enum: [
            { a: 1, b: 2 },
            { b: 2, a: 1 },
          ],
        },
      },
    },
    { properties: { network: { enum: ["visa"], required: ["field"] } } },
    { properties: { network: { pattern: "visa" } } },
    { anyOf: [] },
    { anyOf: [{}] },
    { anyOf: [{ const: "visa" }] },
    { anyOf: [{ required: [] }] },
    { enum: ["visa"] },
    { unknown_operator: true },
  ])("rejects malformed nested constraint forms: %j", (constraints) => {
    const result = audit.audit(context(constraintProfile(constraints)));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.details?.["validPaymentHandlers"]).toBe(0);
    expect(result.details?.["issues"]).toEqual([
      "ucp.payment_handlers.com.example.pay[0].available_instruments[0].constraints: must match the 2026-08-25 nested constraint expression schema",
    ]);
    expect(() => AuditResultSchema.parse(result)).not.toThrow();
  });

  it("keeps the earlier protocol's provider-defined constraints open", () => {
    const result = audit.audit(
      context(constraintProfile({ vendor_operator: [1, 2] }, "2026-04-08")),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("preserves valid handlers beside malformed nested constraints", () => {
    const profile = constraintProfile({ anyOf: [{}] });
    profile.ucp.payment_handlers["com.example.pay"].push({
      id: "valid",
      version: "2026-08-25",
      available_instruments: [{ type: "card", constraints: {} }],
    });
    const result = audit.audit(context(profile));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.details?.["paymentHandlers"]).toBe(2);
    expect(result.details?.["validPaymentHandlers"]).toBe(1);
  });

  it.each(["depth", "width"])(
    "warns when constraint %s exceeds local limits",
    (kind) => {
      let constraints: Record<string, unknown> = {};
      if (kind === "depth") {
        for (let i = 0; i < 40; i++)
          constraints = { properties: { nested: constraints } };
      } else {
        constraints = {
          required: Array.from({ length: 2050 }, (_, i) => `field${i}`),
        };
      }
      const profile = constraintProfile(constraints);
      profile.ucp.payment_handlers["com.example.pay"].push({
        id: "valid",
        version: "2026-08-25",
        available_instruments: [{ type: "card", constraints: {} }],
      });
      const result = audit.audit(context(profile));
      expect(result.status).toBe(CheckStatus.Warn);
      expect(result.details?.["constraintValidationLimited"]).toBe(true);
      expect(result.details?.["validPaymentHandlers"]).toBe(1);
      expect(result.details?.["issueCount"]).toBe(0);
      expect(() => AuditResultSchema.parse(result)).not.toThrow();
    },
  );

  it.each([32, 33])(
    "enforces the %i-level boundary without a false pass",
    (depth) => {
      let literal: unknown = "value";
      for (let i = 0; i < depth - 3; i++) literal = [literal];
      const result = audit.audit(
        context(
          constraintProfile({ properties: { data: { const: literal } } }),
        ),
      );
      expect(result.status).toBe(
        depth === 32 ? CheckStatus.Pass : CheckStatus.Warn,
      );
    },
  );

  it.each([2048, 2049])(
    "enforces the %i-value boundary without a false pass",
    (nodes) => {
      const constraints = {
        required: Array.from({ length: nodes - 2 }, (_, i) => `field${i}`),
      };
      const result = audit.audit(context(constraintProfile(constraints)));
      expect(result.status).toBe(
        nodes === 2048 ? CheckStatus.Pass : CheckStatus.Warn,
      );
    },
  );

  it.each([65536, 65537])(
    "bounds %i string and key bytes per expression",
    (bytes) => {
      const result = audit.audit(
        context(constraintProfile({ required: ["x".repeat(bytes - 8)] })),
      );
      expect(result.status).toBe(
        bytes === 65536 ? CheckStatus.Pass : CheckStatus.Warn,
      );
      if (bytes > 65536) {
        expect(result.details?.["constraintValidationLimits"]).toEqual([
          "ucp.payment_handlers.com.example.pay[0].available_instruments[0].constraints: exceeds 64 KiB of strings and keys",
        ]);
      }
      expect(() => AuditResultSchema.parse(result)).not.toThrow();
    },
  );

  it("names multiple instruments that exceed local validation limits", () => {
    const profile = constraintProfile({ required: ["x".repeat(65536)] });
    profile.ucp.payment_handlers[
      "com.example.pay"
    ][0]!.available_instruments.push({
      type: "card",
      constraints: {
        required: Array.from({ length: 2050 }, (_, i) => `field${i}`),
      },
    });
    const result = audit.audit(context(profile));
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.details?.["constraintValidationLimits"]).toEqual([
      "ucp.payment_handlers.com.example.pay[0].available_instruments[0].constraints: exceeds 64 KiB of strings and keys",
      "ucp.payment_handlers.com.example.pay[0].available_instruments[1].constraints: exceeds 2048 JSON values",
    ]);
  });

  it("reports known defects even when another handler exceeds validation limits", () => {
    const profile = constraintProfile({
      required: Array.from({ length: 2050 }, (_, i) => `field${i}`),
    });
    profile.ucp.payment_handlers["com.example.pay"].push({
      id: "invalid",
      version: "2026-08-25",
      available_instruments: [{ type: "card", constraints: { anyOf: [{}] } }],
    });
    const result = audit.audit(context(profile));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.details?.["constraintValidationLimited"]).toBe(true);
    expect(result.details?.["validPaymentHandlers"]).toBe(0);
    expect(result.details?.["issueCount"]).toBe(1);
  });

  it("reads the legacy capability and payment-handler arrays", () => {
    const result = audit.audit(context(legacy()));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details).toMatchObject({
      validCapabilities: 1,
      validPaymentHandlers: 1,
    });
  });

  it("requires legacy discovery capability fields rather than modern business fields", () => {
    const result = audit.audit(
      context({
        ucp: {
          version: "2026-01-11",
          capabilities: [
            { name: "dev.ucp.shopping.checkout", version: "2026-01-11" },
          ],
        },
      }),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.details?.["issueCount"]).toBe(2);
  });

  it("declines a modern capability registry under the legacy selected version", () => {
    expect(audit.audit(context(modern("2026-01-11"))).status).toBe(
      CheckStatus.Fail,
    );
  });

  it("does not require a legacy optional payment artifact", () => {
    expect(
      audit.audit(context({ ucp: { version: "2026-01-11", capabilities: [] } }))
        .status,
    ).toBe(CheckStatus.Pass);
  });

  it("reports legacy handler field and array item defects", () => {
    const body = legacy();
    const handler: Record<string, unknown> = body.payment.handlers[0]!;
    handler["instrument_schemas"] = ["relative"];
    delete handler["config_schema"];
    const result = audit.audit(context(body));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.details?.["issueCount"]).toBe(2);
  });

  it("caps reported issue strings without hiding the full issue count", () => {
    const result = audit.audit(
      context({
        ucp: {
          version: "2026-08-25",
          capabilities: {
            "dev.ucp.shopping.checkout": Array.from(
              { length: 100 },
              () => null,
            ),
          },
          payment_handlers: {},
        },
      }),
    );
    expect(result.details).toMatchObject({
      issueCount: 100,
      issuesTruncated: true,
    });
    expect(result.details?.["issues"]).toHaveLength(40);
    expect(AuditResultSchema.safeParse(result).success).toBe(true);
  });
});
