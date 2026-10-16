import { describe, it, expect } from "vitest";
import {
  CATEGORY_IDS,
  CaptureSource,
  DocumentState,
  CheckStatus,
  LEGACY_PAGE_TYPES,
  PageType,
} from "@forkpoint/agent-lighthouse-core";
import {
  getArgValue,
  splitList,
  resolveUrl,
  isValidUrl,
  parseCliOptions,
  resolveCommand,
  parseCategoryAssertions,
  failedAssertion,
  selectDebugChecks,
  openCommand,
  PAGE_TYPE_IDS,
} from "./options";

describe("getArgValue", () => {
  it("reads --flag=value", () => {
    expect(getArgValue(["--output-dir=out"], "-d", "--output-dir")).toBe("out");
  });

  it("reads -d=value", () => {
    expect(getArgValue(["-d=out"], "-d", "--output-dir")).toBe("out");
  });

  it("reads --flag value", () => {
    expect(getArgValue(["--output-dir", "out"], "-d", "--output-dir")).toBe(
      "out",
    );
  });

  it("reads -d value", () => {
    expect(getArgValue(["-d", "out"], "-d", "--output-dir")).toBe("out");
  });

  // Without this an `--output-dir --silent` typo writes reports to a directory
  // named "--silent" instead of reporting that no directory was given.
  it("does not take the next flag as a value", () => {
    expect(
      getArgValue(["--output-dir", "--silent"], "-d", "--output-dir"),
    ).toBeUndefined();
  });

  it("returns undefined for a flag that is absent", () => {
    expect(getArgValue(["--silent"], "-d", "--output-dir")).toBeUndefined();
  });

  it("returns undefined for a trailing flag with no value", () => {
    expect(getArgValue(["--output-dir"], "-d", "--output-dir")).toBeUndefined();
  });

  it("supports a long-only flag", () => {
    expect(getArgValue(["--min-score", "85"], "", "--min-score")).toBe("85");
  });

  it("prefers the = form when both appear", () => {
    expect(
      getArgValue(
        ["--output-dir=a", "--output-dir", "b"],
        "-d",
        "--output-dir",
      ),
    ).toBe("a");
  });
});

describe("splitList", () => {
  it("splits on commas and trims", () => {
    expect(splitList("a, b ,c")).toEqual(["a", "b", "c"]);
  });

  it("drops empty entries from a trailing comma", () => {
    expect(splitList("a,,b,")).toEqual(["a", "b"]);
  });

  it("returns undefined when the flag is absent", () => {
    expect(splitList(undefined)).toBeUndefined();
  });

  // Distinct from undefined: the flag was given but empty, so nothing is
  // selected rather than everything.
  it("returns an empty list for an empty value", () => {
    expect(splitList("")).toEqual([]);
  });
});

describe("resolveUrl", () => {
  it("prefers the positional argument", () => {
    expect(resolveUrl("https://a.test", { url: "https://b.test" })).toBe(
      "https://a.test",
    );
  });

  it("falls back to the config file", () => {
    expect(resolveUrl(undefined, { url: "https://b.test" })).toBe(
      "https://b.test",
    );
  });

  it("is undefined when neither is given", () => {
    expect(resolveUrl(undefined, {})).toBeUndefined();
  });
});

describe("isValidUrl", () => {
  it("accepts an absolute https URL", () => {
    expect(isValidUrl("https://example.com/path")).toBe(true);
  });

  it("rejects a bare hostname", () => {
    expect(isValidUrl("example.com")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidUrl("")).toBe(false);
  });
});

describe("parseCliOptions", () => {
  it("defaults everything with no flags and no config", () => {
    const o = parseCliOptions([], "https://example.com");
    expect(o).toMatchObject({
      url: "https://example.com",
      presetIgnored: false,
      minScore: 0,
      outputDir: "./reports",
      outputFormats: ["terminal", "html", "json"],
      categories: undefined,
      unknownCategories: [],
      pageType: undefined,
      invalidPageType: undefined,
      includeExperimental: false,
      isSilent: false,
      progressJson: false,
      shouldView: false,
    });
  });

  it("takes values from the config file when no flag overrides them", () => {
    const o = parseCliOptions([], undefined, {
      url: "https://cfg.test",
      minScore: 70,
      outputDir: "./out",
      output: ["json"],
    });
    expect(o).toMatchObject({
      url: "https://cfg.test",
      minScore: 70,
      outputDir: "./out",
      outputFormats: ["json"],
    });
  });

  // Presets were removed in 8.0.0. The flag and the config key are still
  // recognised so main can warn instead of silently dropping them.
  it.each([
    [["--preset", "ecommerce"], {}],
    [["--preset=ecommerce"], {}],
    [["-p", "ecommerce"], {}],
    [["-p=ecommerce"], {}],
    [[], { preset: "ecommerce" }],
  ])("flags a removed preset in %j %j", (args, fileConfig) => {
    expect(
      parseCliOptions(args, "https://example.com", fileConfig).presetIgnored,
    ).toBe(true);
  });

  it("lets a flag beat the config file", () => {
    const o = parseCliOptions(
      ["--min-score=90", "-d", "./flag-out", "-o", "html"],
      undefined,
      {
        minScore: 70,
        outputDir: "./cfg-out",
        output: ["json"],
      },
    );
    expect(o).toMatchObject({
      minScore: 90,
      outputDir: "./flag-out",
      outputFormats: ["html"],
    });
  });

  // The bug this flag shipped with: it was documented in the help text and
  // never parsed, so a narrowed scan silently ran every category.
  it("parses --categories into a list", () => {
    const [first, second] = CATEGORY_IDS;
    const o = parseCliOptions(
      [`--categories=${first},${second}`],
      "https://a.test",
    );
    expect(o.categories).toEqual([first, second]);
    expect(o.unknownCategories).toEqual([]);
  });

  it("reports category names that do not exist", () => {
    const o = parseCliOptions(
      ["--categories=not-a-category,also-not"],
      "https://a.test",
    );
    expect(o.unknownCategories).toEqual(["not-a-category", "also-not"]);
  });

  it("separates the real categories from the unknown ones", () => {
    const o = parseCliOptions(
      [`--categories=${CATEGORY_IDS[0]},nope`],
      "https://a.test",
    );
    expect(o.categories).toEqual([CATEGORY_IDS[0], "nope"]);
    expect(o.unknownCategories).toEqual(["nope"]);
  });

  it("reads the boolean flags", () => {
    const o = parseCliOptions(
      ["--silent", "--progress-json", "--view", "--experimental"],
      "https://a.test",
    );
    expect(o).toMatchObject({
      isSilent: true,
      progressJson: true,
      shouldView: true,
      includeExperimental: true,
    });
  });

  it("accepts -v as the short form of --view", () => {
    expect(parseCliOptions(["-v"], "https://a.test").shouldView).toBe(true);
  });

  it("reads the config path so the file can be loaded before the rest is parsed", () => {
    expect(parseCliOptions(["-c", "./al.json"], undefined).configPath).toBe(
      "./al.json",
    );
  });

  it("reads --debug-audit", () => {
    const o = parseCliOptions(
      ["--debug-audit=structured-data/json-ld-present"],
      "https://a.test",
    );
    expect(o.debugAudit).toBe("structured-data/json-ld-present");
  });

  // Number("") is 0, so an empty --min-score must not read as "score 0 is fine".
  it("rejects a missing minimum even when config supplies one", () => {
    expect(() =>
      parseCliOptions(["--min-score"], undefined, { minScore: 80 }),
    ).toThrow(/threshold/i);
  });

  it("rejects a non-numeric minimum", () => {
    expect(() => parseCliOptions(["--min-score=abc"], undefined)).toThrow(
      /threshold/i,
    );
  });
});

describe("resolveCommand", () => {
  it("asks for help with no arguments", () => {
    expect(resolveCommand([])).toEqual({ action: "help" });
  });

  it("asks for help on -h and --help", () => {
    expect(resolveCommand(["-h"])).toEqual({ action: "help" });
    expect(resolveCommand(["--help"])).toEqual({ action: "help" });
  });

  it("takes the URL after an explicit audit subcommand", () => {
    expect(resolveCommand(["audit", "https://a.test"])).toEqual({
      action: "audit",
      url: "https://a.test",
    });
  });

  it("takes a bare URL as the target", () => {
    expect(resolveCommand(["https://a.test", "--silent"])).toEqual({
      action: "audit",
      url: "https://a.test",
    });
  });

  it("audits with no URL when the first argument is a flag", () => {
    expect(resolveCommand(["--silent"])).toEqual({ action: "audit" });
  });

  it("audits with no URL when audit is given alone, so the config file supplies it", () => {
    expect(resolveCommand(["audit"])).toEqual({
      action: "audit",
      url: undefined,
    });
  });
});

describe("parseCategoryAssertions", () => {
  it("reads one --assert-category pair", () => {
    expect(
      parseCategoryAssertions(["--assert-category", "structured-data:90"]),
    ).toEqual({
      "structured-data": 90,
    });
  });

  it("reads the = form", () => {
    expect(
      parseCategoryAssertions(["--assert-category=structured-data:90"]),
    ).toEqual({
      "structured-data": 90,
    });
  });

  // getArgValue returns the first occurrence only, which is why this flag
  // cannot go through it: CI pipelines assert on several categories at once.
  it("reads the flag repeated", () => {
    expect(
      parseCategoryAssertions([
        "--assert-category",
        "structured-data:90",
        "--assert-category",
        "agent-interfaces:70",
      ]),
    ).toEqual({ "structured-data": 90, "agent-interfaces": 70 });
  });

  it("merges the config file thresholds", () => {
    expect(
      parseCategoryAssertions(["--assert-category", "structured-data:90"], {
        assertCategories: { "agent-interfaces": 70 },
      }),
    ).toEqual({ "structured-data": 90, "agent-interfaces": 70 });
  });

  it("lets the flag beat the config file for the same category", () => {
    expect(
      parseCategoryAssertions(["--assert-category", "structured-data:95"], {
        assertCategories: { "structured-data": 50 },
      }),
    ).toEqual({ "structured-data": 95 });
  });

  // The loaded config is read again after this, so mutating it would leak.
  it("does not mutate the config file object", () => {
    const fileConfig = { assertCategories: { "structured-data": 50 } };
    parseCategoryAssertions(
      ["--assert-category", "agent-interfaces:70"],
      fileConfig,
    );
    expect(fileConfig.assertCategories).toEqual({ "structured-data": 50 });
  });

  it("rejects a pair with no threshold", () => {
    expect(() =>
      parseCategoryAssertions(["--assert-category", "structured-data"]),
    ).toThrow(/threshold/i);
  });

  it("rejects a trailing flag with no value", () => {
    expect(() => parseCategoryAssertions(["--assert-category"])).toThrow(
      /threshold/i,
    );
  });

  it("returns an empty object when the flag is absent", () => {
    expect(parseCategoryAssertions(["--silent"])).toEqual({});
  });
});

describe("failedAssertion", () => {
  const categories = [
    { id: "structured-data", name: "Structured Data", score: 40 },
    { id: "agent-interfaces", name: "Agent Interfaces", score: 90 },
  ];

  it("returns nothing when every threshold is met", () => {
    expect(
      failedAssertion(categories, { "agent-interfaces": 80 }),
    ).toBeUndefined();
  });

  it("names the category that fell short", () => {
    expect(failedAssertion(categories, { "structured-data": 90 })).toEqual({
      name: "Structured Data",
      score: 40,
      threshold: 90,
    });
  });

  it("treats a score equal to the threshold as a pass", () => {
    expect(
      failedAssertion(categories, { "structured-data": 40 }),
    ).toBeUndefined();
  });

  it("matches on a name substring, so an operator can type a word", () => {
    expect(failedAssertion(categories, { structured: 90 })?.name).toBe(
      "Structured Data",
    );
  });

  // --categories narrows the scan; failing CI over a category the operator
  // excluded on purpose would make the two flags unusable together.
  it("ignores a threshold for a category that did not run", () => {
    expect(
      failedAssertion(categories, { "agentic-commerce": 90 }),
    ).toBeUndefined();
  });

  it("returns nothing when there are no assertions", () => {
    expect(failedAssertion(categories, {})).toBeUndefined();
  });

  it("fails an unassessed category as not assessed, not as scored 0", () => {
    const unassessed = [
      {
        id: "agentic-commerce",
        name: "Agentic Commerce",
        score: 0,
        assessed: false,
      },
    ];
    expect(failedAssertion(unassessed, { "agentic-commerce": 80 })).toEqual({
      name: "Agentic Commerce",
      score: 0,
      threshold: 80,
      notAssessed: true,
    });
    // A threshold of 0 asks for nothing, as `--min-score 0` does.
    expect(
      failedAssertion(unassessed, { "agentic-commerce": 0 }),
    ).toBeUndefined();
  });

  it("passes an assessed category that clears its threshold", () => {
    expect(
      failedAssertion(
        [
          {
            id: "structured-data",
            name: "Structured Data",
            score: 90,
            assessed: true,
          },
        ],
        { "structured-data": 80 },
      ),
    ).toBeUndefined();
  });
});

describe("selectDebugChecks", () => {
  const checks = [
    {
      id: "structured-data/json-ld-present",
      title: "JSON-LD present",
      status: CheckStatus.Pass,
    },
    {
      id: "structured-data/faqpage-schema",
      title: "FAQPage schema",
      status: CheckStatus.Fail,
    },
    {
      id: "agent-interfaces/webmcp",
      title: "WebMCP endpoint",
      status: CheckStatus.Warn,
    },
    {
      id: "agent-interfaces/openapi",
      title: "OpenAPI document",
      status: CheckStatus.NotApplicable,
    },
  ];

  it("selects every fail and warn for the reserved value 'fails'", () => {
    expect(selectDebugChecks(checks, "fails").map((c) => c.id)).toEqual([
      "structured-data/faqpage-schema",
      "agent-interfaces/webmcp",
    ]);
  });

  it("selects an audit by its exact id", () => {
    expect(selectDebugChecks(checks, "agent-interfaces/webmcp")).toHaveLength(
      1,
    );
  });

  it("selects by a title substring, case-insensitively", () => {
    expect(selectDebugChecks(checks, "faqpage").map((c) => c.id)).toEqual([
      "structured-data/faqpage-schema",
    ]);
  });

  it("returns nothing when the id matches no audit", () => {
    expect(selectDebugChecks(checks, "no-such-audit")).toEqual([]);
  });
});

describe("openCommand", () => {
  it("uses open on macOS", () => {
    expect(openCommand("darwin", "/tmp/report.html")).toBe(
      'open "/tmp/report.html"',
    );
  });

  // The empty first argument is the window title, which `start` requires when
  // the path is quoted.
  it("uses start with an empty title on Windows", () => {
    expect(openCommand("win32", "C:\\report.html")).toBe(
      'start "" "C:\\report.html"',
    );
  });

  it("uses xdg-open elsewhere", () => {
    expect(openCommand("linux", "/tmp/report.html")).toBe(
      'xdg-open "/tmp/report.html"',
    );
  });
});

describe("--page-type", () => {
  it.each(["product", "article", "general"])("passes %s through", (type) => {
    const o = parseCliOptions([`--page-type=${type}`], "https://example.com");
    expect(o.pageType).toBe(type);
    expect(o.invalidPageType).toBeUndefined();
  });

  it("accepts the space-separated form", () => {
    const o = parseCliOptions(
      ["--page-type", "category"],
      "https://example.com",
    );
    expect(o.pageType).toBe(PageType.Category);
  });

  it("rejects a value that names no page type, at parse time", () => {
    const o = parseCliOptions(["--page-type=produtc"], "https://example.com");
    expect(o.pageType).toBeUndefined();
    expect(o.invalidPageType).toBe("produtc");
  });

  it("lists every page type the core knows", () => {
    expect(PAGE_TYPE_IDS).toEqual([
      "homepage",
      "category",
      "product",
      "article",
      "general",
    ]);
  });

  it.each(["unknown", "content"])(
    "refuses the pre-v7 page type %s",
    (legacy) => {
      const o = parseCliOptions(
        [`--page-type=${legacy}`],
        "https://example.com",
      );
      expect(o.pageType).toBeUndefined();
      expect(o.invalidPageType).toBe(legacy);
    },
  );
  it("keeps the old names for the error message", () => {
    expect(LEGACY_PAGE_TYPES).toEqual({
      unknown: "general",
      content: "general",
    });
  });
});

describe("--timeout", () => {
  it("is unset by default, so the scan uses the core default", () => {
    const o = parseCliOptions([], "https://a.test");
    expect(o.timeoutSeconds).toBeUndefined();
    expect(o.invalidTimeout).toBeUndefined();
  });

  it("reads seconds from the flag in both forms", () => {
    expect(
      parseCliOptions(["--timeout", "600"], "https://a.test").timeoutSeconds,
    ).toBe(600);
    expect(
      parseCliOptions(["--timeout=45"], "https://a.test").timeoutSeconds,
    ).toBe(45);
  });

  it("accepts 0 as 'no budget'", () => {
    const o = parseCliOptions(["--timeout", "0"], "https://a.test");
    expect(o.timeoutSeconds).toBe(0);
    expect(o.invalidTimeout).toBeUndefined();
  });

  it("takes the config file value when the flag is absent, and lets the flag win", () => {
    expect(
      parseCliOptions([], "https://a.test", { timeout: 300 }).timeoutSeconds,
    ).toBe(300);
    expect(
      parseCliOptions(["--timeout", "20"], "https://a.test", { timeout: 300 })
        .timeoutSeconds,
    ).toBe(20);
  });

  // Number("") is 0 and 0 disables the budget, so a bare --timeout must be
  // refused rather than read as "run forever".
  it("refuses a bare --timeout and a non-numeric or negative value", () => {
    expect(
      parseCliOptions(["--timeout"], "https://a.test").invalidTimeout,
    ).toBe("");
    expect(
      parseCliOptions(["--timeout", "soon"], "https://a.test").invalidTimeout,
    ).toBe("soon");
    expect(
      parseCliOptions(["--timeout=-5"], "https://a.test").invalidTimeout,
    ).toBe("-5");
    expect(
      parseCliOptions(["--timeout", "soon"], "https://a.test").timeoutSeconds,
    ).toBeUndefined();
  });
});

describe("--timeout from the config file", () => {
  it("refuses a negative or non-numeric config value rather than dropping the budget", () => {
    const negative = parseCliOptions([], "https://a.test", { timeout: -5 });
    expect(negative.timeoutSeconds).toBeUndefined();
    expect(negative.invalidTimeout).toBe("-5 (config file)");

    const text = parseCliOptions([], "https://a.test", {
      timeout: "soon" as unknown as number,
    });
    expect(text.timeoutSeconds).toBeUndefined();
    expect(text.invalidTimeout).toBe("soon (config file)");
  });

  it("prints an object config value as JSON, not [object Object]", () => {
    const timeout = parseCliOptions([], "https://a.test", {
      timeout: { seconds: 30 } as unknown as number,
    });
    expect(timeout.invalidTimeout).toBe('{"seconds":30} (config file)');

    const pageType = parseCliOptions([], "https://a.test", {
      pageType: { type: "product" } as unknown as PageType,
    });
    expect(pageType.invalidPageType).toBe('{"type":"product"}');
  });

  it("lets a valid flag stand in for a bad config value", () => {
    const o = parseCliOptions(["--timeout", "30"], "https://a.test", {
      timeout: -5,
    });
    expect(o.timeoutSeconds).toBe(30);
    expect(o.invalidTimeout).toBeUndefined();
  });
});

describe("v7 manual page declarations", () => {
  it("reads config declarations and lets the flag override the target only", () => {
    const config = {
      pageType: PageType.Product,
      pages: [{ url: "https://example.com/guide", pageType: PageType.Article }],
    };
    const before = structuredClone(config);
    expect(parseCliOptions([], "https://example.com", config)).toMatchObject(
      config,
    );
    expect(
      parseCliOptions(["--page-type=general"], "https://example.com", config),
    ).toMatchObject({ pageType: PageType.General, pages: config.pages });
    expect(config).toEqual(before);
  });
  it.each([
    { args: ["--page-type"] },
    { args: ["--page-type="] },
    { args: ["--page-type", "--silent"] },
  ])(
    "rejects missing declaration $args instead of detecting silently",
    ({ args }) => {
      expect(
        parseCliOptions(args, "https://example.com", {
          pageType: PageType.Article,
        }).invalidPageType,
      ).toBe("");
    },
  );
  it.each([
    { pages: [{ url: "broken", pageType: PageType.Article }] },
    { pageType: "author" },
    { pages: [{ url: "https://example.com", pageType: "typo" }] },
  ])("rejects invalid config %j", (config) => {
    expect(
      parseCliOptions([], "https://example.com", config as never)
        .invalidPageScope,
    ).toBeDefined();
  });
  it("includes mixed-population failures in debug fails", () => {
    const checks = [
      {
        id: "mixed",
        title: "Mixed",
        status: CheckStatus.Pass,
        advisoryResults: [{ status: CheckStatus.Fail }],
      },
      { id: "pass", title: "Pass", status: CheckStatus.Pass },
    ];
    expect(selectDebugChecks(checks, "fails")).toEqual([checks[0]]);
  });
});

describe("score threshold validation", () => {
  it.each(["abc", "", " ", "NaN", "Infinity", "-1", "101", "80:90"])(
    "rejects invalid thresholds %j",
    (value) => {
      expect(() =>
        parseCliOptions([`--min-score=${value}`], "https://example.com"),
      ).toThrow(/threshold/i);
      expect(() =>
        parseCategoryAssertions([`--assert-category=structured-data:${value}`]),
      ).toThrow(/threshold/i);
    },
  );
  it.each(["--min-score", "--min-score="])(
    "rejects missing minimum %s",
    (flag) => {
      expect(() =>
        parseCliOptions([flag, "--silent"], "https://example.com"),
      ).toThrow(/threshold/i);
    },
  );
  it.each([
    "--assert-category",
    "--assert-category=",
    "--assert-category=structured-data",
    "--assert-category=:50",
  ])("rejects missing category pair %s", (flag) => {
    expect(() => parseCategoryAssertions([flag, "--silent"])).toThrow(
      /threshold/i,
    );
  });
  it.each([NaN, Infinity, -1, 101, "50", null, true, {}])(
    "rejects invalid config threshold %j",
    (value) => {
      expect(() =>
        parseCliOptions([], "https://example.com", {
          minScore: value as number,
        }),
      ).toThrow(/threshold/i);
      expect(() =>
        parseCategoryAssertions([], {
          assertCategories: { "structured-data": value as number },
        }),
      ).toThrow(/threshold/i);
    },
  );
  it.each([0, 50.5, 100])("preserves valid threshold %s", (value) => {
    expect(parseCliOptions([`--min-score=${value}`], undefined).minScore).toBe(
      value,
    );
    expect(
      parseCategoryAssertions([`--assert-category=structured-data:${value}`]),
    ).toEqual({ "structured-data": value });
  });
});

describe("review threshold boundaries", () => {
  it.each([50, true, null, [], [50], "", "structured-data:80"])(
    "rejects invalid assertion config shape %j",
    (assertCategories) => {
      expect(() =>
        parseCategoryAssertions([], {
          assertCategories: assertCategories as never,
        }),
      ).toThrow(/assertCategories.*object/i);
    },
  );
  it.each([
    ["--min-score=80", "--min-score=abc"],
    ["--min-score=80", "--min-score"],
    ["--min-score=80", "--min-score="],
    ["--min-score=80", "--min-score", "--silent"],
    ["--min-score=80", "--min-score", "101"],
    ["--min-score", "abc", "--min-score=80"],
    ["--min-score", "--silent", "--min-score=80"],
  ])("validates every minimum occurrence %j", (...args) => {
    expect(() => parseCliOptions(args, undefined)).toThrow(/threshold/i);
  });
  it.each([
    { args: ["--min-score=0", "--min-score=100"], expected: 0 },
    { args: ["--min-score", "50", "--min-score", "80"], expected: 50 },
    { args: ["--min-score", "50", "--min-score=80"], expected: 80 },
  ])(
    "keeps existing precedence for valid repeats $args",
    ({ args, expected }) => {
      expect(parseCliOptions(args, undefined).minScore).toBe(expected);
    },
  );
  it("allows omitted and empty assertion maps", () => {
    expect(parseCategoryAssertions([])).toEqual({});
    expect(parseCategoryAssertions([], { assertCategories: {} })).toEqual({});
  });
});

describe("browser snapshot config", () => {
  it("preserves valid input and reports unsupported versions", () => {
    const snapshots = {
      version: 1 as const,
      pages: [
        {
          requestedUrl: "https://shop.test/",
          capturedUrl: "https://shop.test/",
          html: "<p>Captured page</p>",
          capturedAt: "2026-10-13T10:00:00Z",
          captureSource: CaptureSource.CurrentTab,
          collector: { name: "fixture", version: "1" },
          documentState: DocumentState.Complete,
          truncation: { truncated: false },
          redaction: { redacted: false, fields: [] },
        },
      ],
    };
    expect(
      parseCliOptions([], "https://shop.test/", { snapshots }).snapshots,
    ).toEqual(snapshots);
    const invalid = parseCliOptions([], "https://shop.test/", {
      snapshots: { ...snapshots, version: 2 } as never,
    });
    expect(invalid.invalidSnapshots).toBeTruthy();
    expect(invalid.invalidPageScope).toBeUndefined();
    expect(invalid.snapshots).toBeUndefined();
  });
});
