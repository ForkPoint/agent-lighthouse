/** Keep both theme controls and system preference changes in sync. */
export function mountTheme() {
  const button = document.getElementById("theme-toggle");
  if (!button) return;
  const root = document.documentElement;
  const system = matchMedia("(prefers-color-scheme: dark)");
  let chosen = false;
  try {
    chosen = ["light", "dark"].includes(localStorage.getItem("al-theme") ?? "");
  } catch {
    /* Storage is optional. */
  }
  const update = () => {
    const label =
      root.dataset.theme === "dark" ? "Use light mode" : "Use dark mode";
    button.textContent =
      root.dataset.theme === "dark" ? "Light mode" : "Dark mode";
    button.setAttribute("aria-label", label);
  };
  button.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    chosen = true;
    try {
      localStorage.setItem("al-theme", root.dataset.theme);
    } catch {
      /* The current page still switches. */
    }
    update();
  });
  system.addEventListener("change", () => {
    if (!chosen) {
      root.dataset.theme = system.matches ? "dark" : "light";
      update();
    }
  });
  update();
  button.hidden = false;
}
