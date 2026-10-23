// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountScanHelpForm } from "./scan-help";

let form: HTMLFormElement;
let button: HTMLButtonElement;
beforeEach(() => {
  document.body.innerHTML = `<form id="scan-help-form" action="https://submit.magnifito.com/s/test" method="post">
    <input name="website" type="url" required value="https://example.com">
    <input name="email" type="email" required value="reader@example.com">
    <textarea name="question">Help with a finding</textarea>
    <input type="text" name="_ff_honey" tabindex="-1" autocomplete="off">
    <button type="submit">Send request</button>
    <p id="scan-help-status" role="status"></p>
  </form>`;
  form = document.querySelector("form")!;
  button = document.querySelector("button")!;
  mountScanHelpForm();
});
afterEach(() => vi.unstubAllGlobals());
const submit = () =>
  form.dispatchEvent(new Event("submit", { cancelable: true }));
const status = () => document.querySelector("#scan-help-status")!.textContent;

describe("scan help submission", () => {
  it("sends the fields once and confirms receipt after acceptance", async () => {
    let finish!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    submit();
    submit();
    expect(button.disabled).toBe(true);
    expect(status()).toBe("Sending your request…");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const body = fetcher.mock.calls.at(0)?.[1]?.body;
    if (!(body instanceof FormData)) throw new Error("Expected form data");
    expect(Object.fromEntries(body.entries())).toEqual({
      website: "https://example.com",
      email: "reader@example.com",
      question: "Help with a finding",
      // FormFlow reads an empty honeypot as a person.
      _ff_honey: "",
    });
    finish(new Response("{}", { status: 200 }));
    await vi.waitFor(() =>
      expect(status()).toContain("has received your request"),
    );
    expect(button.textContent).toBe("Request sent");
    expect(form.hasAttribute("aria-busy")).toBe(false);
    submit();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([429, 500, "network", "timeout"])(
    "keeps entered details after %s and allows retry",
    async (failure) => {
      const fetcher = vi.fn();
      if (typeof failure === "number")
        fetcher.mockResolvedValue(new Response("{}", { status: failure }));
      else
        fetcher.mockRejectedValue(
          new DOMException(
            failure,
            failure === "timeout" ? "TimeoutError" : "NetworkError",
          ),
        );
      vi.stubGlobal("fetch", fetcher);
      submit();
      await vi.waitFor(() => expect(status()).toContain("could not confirm"));
      expect(button.disabled).toBe(false);
      expect(
        form.querySelector<HTMLInputElement>('[name="email"]')!.value,
      ).toBe("reader@example.com");
      expect(form.querySelector("textarea")!.value).toBe("Help with a finding");
      fetcher.mockResolvedValue(new Response("{}", { status: 200 }));
      submit();
      await vi.waitFor(() =>
        expect(status()).toContain("has received your request"),
      );
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );

  it("does not send invalid fields", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    form.querySelector<HTMLInputElement>('[name="email"]')!.value = "invalid";
    submit();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
