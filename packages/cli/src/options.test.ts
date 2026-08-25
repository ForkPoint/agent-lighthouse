import { describe, it, expect } from "vitest";
import { CATEGORY_IDS } from "@forkpoint/agent-lighthouse-core";
import {
  getArgValue,
  splitList,
  resolveUrl,
  isValidUrl,
  parseCliOptions,
  resolveCommand,
} from "./options";

describe("getArgValue", () => {
  it("reads --flag=value", () => {
    expect(getArgValue(["--preset=ecommerce"], "-p", "--preset")).toBe("ecommerce");
  });

  it("reads -p=value", () => {
    expect(getArgValue(["-p=ecommerce"], "-p", "--preset")).toBe("ecommerce");
  });

  it("reads --flag value", () => {
    expect(getArgValue(["--preset", "ecommerce"], "-p", "--preset")).toBe("ecommerce");
  });

  it("reads -p value", () => {
    expect(getArgValue(["-p", "ecommerce"], "-p", "--preset")).toBe("ecommerce");
  });

  // Without this a `--preset --silent` typo scans with a preset named
  // "--silent" instead of reporting that no preset was given.
  it("does not take the next flag as a value", () => {
    expect(getArgValue(["--preset", "--silent"], "-p", "--preset")).toBeUndefined();
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
    expect(getArgValue(["--preset=a", "--preset", "b"], "-p", "--preset")).toBe("a");
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
    expect(resolveUrl("https://a.test", { url: "https://b.test" })).toBe("https://a.test");
  });

  it("falls back to the config file", () => {
    expect(resolveUrl(undefined, { url: "https://b.test" })).toBe("https://b.test");
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
      { preset: "ecommerce", minScore: 70, outputDir: "./cfg-out", output: ["json"] },
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
    const o = parseCliOptions([`--categories=${first},${second}`], "https://a.test");
    expect(o.categories).toEqual([first, second]);
    expect(o.unknownCategories).toEqual([]);
  });

  it("reports category names that do not exist", () => {
    const o = parseCliOptions(["--categories=not-a-category,also-not"], "https://a.test");
    expect(o.unknownCategories).toEqual(["not-a-category", "also-not"]);
  });

  it("separates the real categories from the unknown ones", () => {
    const o = parseCliOptions([`--categories=${CATEGORY_IDS[0]},nope`], "https://a.test");
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
    expect(parseCliOptions(["-c", "./al.json"], undefined).configPath).toBe("./al.json");
  });

  it("reads --debug-audit", () => {
    const o = parseCliOptions(["--debug-audit=structured-data/json-ld-present"], "https://a.test");
    expect(o.debugAudit).toBe("structured-data/json-ld-present");
  });

  // Number("") is 0, so an empty --min-score must not read as "score 0 is fine".
  it("keeps the config minScore when --min-score is given no value", () => {
    const o = parseCliOptions(["--min-score"], "https://a.test", { minScore: 60 });
    expect(o.minScore).toBe(60);
  });

  it("produces NaN for a non-numeric --min-score rather than guessing", () => {
    expect(parseCliOptions(["--min-score=abc"], "https://a.test").minScore).toBeNaN();
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
    expect(resolveCommand(["audit"])).toEqual({ action: "audit", url: undefined });
  });
});
