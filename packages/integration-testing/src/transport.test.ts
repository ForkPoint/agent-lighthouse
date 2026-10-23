import { describe, expect, it } from "vitest";
import { isPublicAddress, createPrivateTransport } from "./transport";
describe("private transport address policy", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "::",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "2002:7f00:1::1",
  ])("refuses %s", (address) => expect(isPublicAddress(address)).toBe(false));
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "accepts public %s",
    (address) => expect(isPublicAddress(address)).toBe(true),
  );
  it.each([
    "https://127.0.0.1/checkout_sessions",
    "https://[::1]/checkout_sessions",
    "https://other.example/checkout_sessions",
  ])("rejects unsafe target before connection", async (url) => {
    const transport = createPrivateTransport("https://sandbox.example");
    try {
      await expect(
        transport.fetch({
          url,
          method: "GET",
          headers: {},
          signal: new AbortController().signal,
          timeout: 100,
          followRedirects: false,
          acceptHeader: "application/json",
        }),
      ).rejects.toThrow("unsafe target");
    } finally {
      await transport.close();
    }
  });
});
