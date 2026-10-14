// Corpus evidence only. This does not change the runtime page classifier.
export function productDetailEvidence($, pageUrl) {
  const pathname = new URL(pageUrl).pathname;
  if (!/\/(?:p|pd|products?)\//i.test(pathname)) return undefined;
  const item = pathname
    .split("/")
    .at(-1)
    ?.replace(/\.html$/i, "");
  if (!item || !/^(?:[A-Z][A-Z0-9_-]*\d[A-Z0-9_-]*|\d{5,})$/.test(item))
    return undefined;
  const primary = $(
    "main,#maincontent,#main-content,#MainContent,#main,[role=main]",
  )
    .first()
    .clone();
  primary
    .find(
      "script,style,nav,header,footer,aside,[hidden],[aria-hidden=true],[class*=related],[class*=recommend],[class*=carousel]",
    )
    .remove();
  const heading = primary.find("h1").first().text().trim();
  if (
    !heading ||
    /^(?:null|undefined|loading|view all|shop all|products)$/i.test(heading)
  )
    return undefined;
  if (
    primary.find(
      ".toolbar-sorter,select[name*=sort],[id*=sorter],[class*=sort-options]",
    ).length
  )
    return undefined;
  const purchase = primary
    .find("button,input[type=submit],a[role=button]")
    .toArray()
    .some((element) =>
      /add\s+to\s+(?:cart|bag|basket)/i.test(
        $(element).text() || $(element).attr("value") || "",
      ),
    );
  const text = primary.text().replace(/\s+/g, " ");
  const price = text.match(
    /(?:[£€$]\s*\d[\d.,]*|\d[\d.,]*\s*(?:€|US\$|CHF))/,
  )?.[0];
  return purchase && price
    ? { heading, item, price, purchaseControl: true }
    : undefined;
}
