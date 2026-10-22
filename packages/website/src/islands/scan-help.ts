/** Enhance the native POST form without changing its no-JavaScript path. */
export function mountScanHelpForm(): void {
  const form = document.querySelector<HTMLFormElement>("#scan-help-form");
  const status = document.querySelector<HTMLElement>("#scan-help-status");
  const button = form?.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );
  if (!form || !status || !button) return;
  let pending = false;
  let sent = false;
  const send = async () => {
    pending = true;
    button.disabled = true;
    form.setAttribute("aria-busy", "true");
    status.textContent = "Sending your request…";
    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error("Submission refused");
      sent = true;
      form.reset();
      status.textContent = "Thank you. ForkPoint has received your request.";
      button.textContent = "Request sent";
    } catch {
      status.textContent =
        "We could not confirm your request. Your details are still here. Please try again later.";
    } finally {
      pending = false;
      button.disabled = sent;
      form.removeAttribute("aria-busy");
    }
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (pending || sent || !form.reportValidity()) return;
    void send();
  });
}
