/** Apply one external-link policy to page content and links added by site tools. */
export function mountExternalLinks(root: HTMLElement = document.body) {
  const originals = new WeakMap<
    HTMLAnchorElement,
    Record<string, string | null>
  >();
  const attributes = ["target", "rel", "aria-describedby", "title"] as const;
  const apply = (link: HTMLAnchorElement) => {
    let external = false;
    try {
      const url = new URL(link.getAttribute("href") ?? "", location.href);
      external =
        /^https?:$/.test(url.protocol) && url.origin !== location.origin;
    } catch {
      /* Leave malformed links unchanged. */
    }
    if (!external) {
      const previous = originals.get(link);
      if (previous) {
        for (const name of attributes) {
          const value = previous[name];
          if (value == null) link.removeAttribute(name);
          else link.setAttribute(name, value);
        }
        originals.delete(link);
      }
      return;
    }
    if (!originals.has(link)) {
      originals.set(
        link,
        Object.fromEntries(
          attributes.map((name) => [name, link.getAttribute(name)]),
        ),
      );
    }
    link.target = "_blank";
    link.relList.add("noopener", "noreferrer");
    const descriptions = new Set(
      (link.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .filter(Boolean),
    );
    descriptions.add("external-link-hint");
    link.setAttribute("aria-describedby", [...descriptions].join(" "));
    if (!link.hasAttribute("title")) link.title = "Opens in a new tab";
  };
  const scan = (node: Element) => {
    if (node instanceof HTMLAnchorElement && node.hasAttribute("href"))
      apply(node);
    node.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(apply);
  };
  scan(root);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (
        record.type === "attributes" &&
        record.target instanceof HTMLAnchorElement
      )
        apply(record.target);
      for (const node of record.addedNodes)
        if (node instanceof Element) scan(node);
    }
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href"],
  });
  return () => observer.disconnect();
}
