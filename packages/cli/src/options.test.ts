import { describe, it, expect } from "vitest";
import { CATEGORY_IDS } from "@forkpoint/agent-lighthouse-core";
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
} from "./options";

describe("getArgValue", () => {
  it("reads --flag=value", () => {
    expect(getArgValue(["--preset=ecommerce"], "-p", "--preset")).toBe(
      "ecommerce",
    );
  });

  it("reads -p=value", () => {
    expect(getArgValue(["-p=ecommerce"], "-p", "--preset")).toBe("ecommerce");
  });

  it("reads --flag value", () => {
    expect(getArgValue(["--preset", "ecommerce"], "-p", "--preset")).toBe(
      "ecommerce",
    );
  });

  it("reads -p value", () => {
    expect(getArgValue(["-p", "ecommerce"], "-p", "--preset")).toBe(
      "ecommerce",
    );
  });

  // Without this a `--preset --silent` typo scans with a preset named
  // "--silent" instead of reporting that no preset was given.
  it("does not take the next flag as a value", () => {
    expect(
      getArgValue(["--preset", "--silent"], "-p", "--preset"),
    ).toBeUndefined();
  });

  it("returns undefined for a flag that is absent", () => {
    expect(getArgValue(["--silent"], "-p", "--preset")).toBeUndefined();
  });

  it("returns undefined for a trailing flag with no value", () => {
    expect(getArgValue(["--preset"], "-p", "--preset")).toBeUndefined();
  });

  it("supports a long-only flag", () => {
    expect(getArgValue(["--min-score", "85"], "", "--min-score")).toBe("85");
  });

  it("prefers the = form when both appear", () => {
    expect(getArgValue(["--preset=a", "--preset", "b"], "-p", "--preset")).toBe(
      "a",
    );
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
      presetName: "full",
      minScore: 0,
      outputDir: "./reports",
      outputFormats: ["terminal", "html", "json"],
      categories: undefined,
      unknownCategories: [],
      includeExperimental: false,
      isSilent: false,
      progressJson: false,
      shouldView: false,
    });
  });

  it("takes values from the config file when no flag overrides them", () => {
    const o = parseCliOptions([], undefined, {
      url: "https://cfg.test",
      preset: "ecommerce",
      minScore: 70,
      outputDir: "./out",
      output: ["json"],
    });
    expect(o).toMatchObject({
      url: "https://cfg.test",
      presetName: "ecommerce",
      minScore: 70,
      outputDir: "./out",
      outputFormats: ["json"],
    });
  });

  it("lets a flag beat the config file", () => {
    const o = parseCliOptions(
      ["--preset=full", "--min-score=90", "-d", "./flag-out", "-o", "html"],
      undefined,
      {
        preset: "ecommerce",
        minScore: 70,
        outputDir: "./cfg-out",
        output: ["json"],
      },
    );
    expect(o).toMatchObject({
      presetName: "full",
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
  it("keeps the config minScore when --min-score is given no value", () => {
    const o = parseCliOptions(["--min-score"], "https://a.test", {
      minScore: 60,
    });
    expect(o.minScore).toBe(60);
  });

  it("produces NaN for a non-numeric --min-score rather than guessing", () => {
    expect(
      parseCliOptions(["--min-score=abc"], "https://a.test").minScore,
    ).toBeNaN();
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

  it("ignores a pair with no threshold", () => {
    expect(
      parseCategoryAssertions(["--assert-category", "structured-data"]),
    ).toEqual({});
  });

  it("ignores a trailing flag with no value", () => {
    expect(parseCategoryAssertions(["--assert-category"])).toEqual({});
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

  // --preset and --categories both narrow the scan; failing CI over a category
  // the operator excluded on purpose would make the flags unusable together.
  it("ignores a threshold for a category that did not run", () => {
    expect(
      failedAssertion(categories, { "agentic-commerce": 90 }),
    ).toBeUndefined();
  });

  it("returns nothing when there are no assertions", () => {
    expect(failedAssertion(categories, {})).toBeUndefined();
  });
});

describe("selectDebugChecks", () => {
  const checks = [
    {
      id: "structured-data/json-ld-present",
      title: "JSON-LD present",
      status: "pass",
    },
    {
      id: "structured-data/faqpage-schema",
      title: "FAQPage schema",
      status: "fail",
    },
    { id: "agent-interfaces/webmcp", title: "WebMCP endpoint", status: "warn" },
    { id: "agent-interfaces/openapi", title: "OpenAPI document", status: "na" },
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
