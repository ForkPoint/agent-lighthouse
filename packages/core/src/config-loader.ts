import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PresetName } from "./presets";

export interface AgentLighthouseConfig {
  /** Target URL (if not supplied via CLI) */
  url?: string;
  /** Audit preset profile */
  preset?: PresetName;
  /** Categories to execute (default: all) */
  categories?: string[];
  /** Minimum score threshold (0-100) to fail CI */
  minScore?: number;
  /** Per-category minimum score assertions */
  assertCategories?: Record<string, number>;
  /** Output report formats (terminal, html, json, md) */
  output?: Array<"terminal" | "html" | "json" | "md">;
  /** Output directory for reports */
  outputDir?: string;
  /** Maximum number of pages to discover & scan */
  maxPages?: number;
}

/** Helper function for type-safe configuration files */
export function defineConfig(
  config: AgentLighthouseConfig,
): AgentLighthouseConfig {
  return config;
}

const DEFAULT_CONFIG_FILES = [
  "agent-lighthouse.config.json",
  ".agent-lighthouserc.json",
  ".agent-lighthouserc",
];

/**
 * Loads Agent Lighthouse configuration from a file.
 */
export function loadConfigFile(customPath?: string): AgentLighthouseConfig {
  if (customPath) {
    const fullPath = resolve(customPath);
    if (!existsSync(fullPath)) {
      throw new Error(`Config file not found at: ${fullPath}`);
    }
    const content = readFileSync(fullPath, "utf8");
    return JSON.parse(content) as AgentLighthouseConfig;
  }

  for (const filename of DEFAULT_CONFIG_FILES) {
    const fullPath = resolve(process.cwd(), filename);
    if (existsSync(fullPath)) {
      try {
        const content = readFileSync(fullPath, "utf8");
        return JSON.parse(content) as AgentLighthouseConfig;
      } catch (err) {
        console.warn(`[config] Failed to parse ${filename}:`, err);
      }
    }
  }

  return {};
}
