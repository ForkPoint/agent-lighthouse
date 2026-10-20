import { describe, expect, it } from "vitest";
import {
  BOT_REGISTRY,
  BotPurpose,
  BotToken,
  botEntry,
  botsByPurpose,
} from "#core/bot-registry";

describe("BOT_REGISTRY", () => {
  it("has exactly one row per BotToken", () => {
    const tokens = BOT_REGISTRY.map((bot) => bot.token);
    expect(new Set(tokens).size).toBe(tokens.length);
    expect([...tokens].sort()).toEqual(Object.values(BotToken).sort());
  });

  it("gives every documented row an https operator page and a date", () => {
    for (const bot of BOT_REGISTRY.filter((b) => b.documented)) {
      expect(bot.docUrl, bot.token).toMatch(/^https:\/\//);
      expect(bot.verified, bot.token).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(bot.purpose, bot.token).not.toBe(BotPurpose.Unknown);
    }
  });

  it("keeps the undocumented rows inert", () => {
    const undocumented = BOT_REGISTRY.filter((b) => !b.documented);
    expect(undocumented.map((b) => b.token).sort()).toEqual([
      BotToken.Bytespider,
      BotToken.CohereAi,
    ]);
    for (const bot of undocumented) {
      expect(bot.docUrl).toBeNull();
      expect(bot.purpose).toBe(BotPurpose.Unknown);
      expect(bot.probe).toBeNull();
    }
  });

  it("never probes a control token or a search engine with a fake-bot rule", () => {
    for (const bot of BOT_REGISTRY) {
      if (bot.controlToken) expect(bot.probe, bot.token).toBeNull();
    }
    expect(botEntry(BotToken.Googlebot).probe).toBeNull();
    expect(botEntry(BotToken.Bingbot).probe).toBeNull();
  });

  it("sends only vendor strings, except the two marked observed", () => {
    for (const bot of BOT_REGISTRY) {
      if (!bot.probe) continue;
      expect(bot.probe.ua.toLowerCase(), bot.token).toContain(
        bot.token.toLowerCase(),
      );
      if (!bot.probe.observed) {
        expect(bot.userAgents, bot.token).toContain(bot.probe.ua);
      }
    }
    expect(
      BOT_REGISTRY.filter((b) => b.probe?.observed).map((b) => b.token),
    ).toEqual([BotToken.ClaudeBot, BotToken.ClaudeUser]);
  });

  it("selects documented rows by purpose, in registry order", () => {
    expect(botsByPurpose(BotPurpose.Training).map((b) => b.token)).toEqual([
      BotToken.GPTBot,
      BotToken.GoogleExtended,
      BotToken.ClaudeBot,
      BotToken.ApplebotExtended,
      BotToken.CCBot,
      BotToken.MetaExternalAgent,
      BotToken.Amazonbot,
      BotToken.AI2Bot,
      BotToken.MistralAITraining,
    ]);
  });
});
