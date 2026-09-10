// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mountTheme } from "./theme";

describe("theme preference", () => {
  let change: () => void;
  let system: { matches: boolean; addEventListener: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = "light";
    document.body.innerHTML = '<button id="theme-toggle" hidden></button>';
    system = {
      matches: false,
      addEventListener: vi.fn((_, callback) => {
        change = callback;
      }),
    };
    vi.stubGlobal("matchMedia", () => system);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it("switches the page, updates its accessible label and saves the choice", () => {
    mountTheme();
    const button = document.querySelector("button")!;
    expect(button.hidden).toBe(false);
    button.click();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(button.getAttribute("aria-label")).toBe("Use light mode");
    expect(localStorage.getItem("al-theme")).toBe("dark");
    button.click();
    expect(document.documentElement.dataset.theme).toBe("light");
  });
  it("follows system changes until the visitor chooses a theme", () => {
    mountTheme();
    system.matches = true;
    change();
    expect(document.documentElement.dataset.theme).toBe("dark");
    document.querySelector("button")!.click();
    change();
    expect(document.documentElement.dataset.theme).toBe("light");
  });
  it("keeps a saved choice when the system changes", () => {
    localStorage.setItem("al-theme", "light");
    mountTheme();
    system.matches = true;
    change();
    expect(document.documentElement.dataset.theme).toBe("light");
  });
  it("still switches when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    mountTheme();
    document.querySelector("button")!.click();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
