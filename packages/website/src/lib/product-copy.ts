/** Visitor-facing summaries. Audit rules and category identities stay in core. */
export const categoryBenefits: Record<string, string> = {
  "access-crawl-control":
    "Check whether crawler rules and page responses allow access to your content.",
  "machine-discovery":
    "Check the files and links that help machines find your pages.",
  "agent-interfaces":
    "Check how your site describes forms, APIs and actions for AI tools.",
  "agentic-commerce":
    "Check whether product details, offers and checkout information are clear to machines.",
  "answer-readiness":
    "Check whether your content gives clear answers with supporting facts.",
  "content-extraction":
    "Check whether machines can read the main content of your pages.",
  "structured-data":
    "Check the structured labels that describe your products, pages and business.",
  "operability-safety":
    "Check secure access, stable responses and signals that support safe use.",
};

export const benefits = [
  {
    title: "Help AI find your pages",
    label: "AI discovery",
    category: "machine-discovery",
    text: "Find gaps in sitemaps, discovery files and links that help machines locate your content.",
  },
  {
    title: "Make your answers easier to use",
    label: "Answers & citations",
    category: "answer-readiness",
    text: "Check page structure, clear answers and supporting facts. See what could make your content harder to read or cite.",
  },
  {
    title: "Make useful actions clear",
    label: "Forms & actions",
    category: "agent-interfaces",
    text: "Check forms and published action interfaces. Find missing labels or unclear instructions for AI tools.",
  },
  {
    title: "Make your products easier to understand",
    label: "Commerce readiness",
    category: "agentic-commerce",
    text: "Check product data, prices, availability and checkout signals. See where shop information needs attention.",
  },
  {
    title: "Set clear rules for access",
    label: "Crawl access & safety",
    category: "access-crawl-control",
    text: "Review crawler permissions and access barriers. Check secure connections and safety signals in the report.",
  },
  {
    title: "Know what to fix next",
    label: "Results & next steps",
    category: "operability-safety",
    text: "Get findings, priorities and guidance in a scan report. Start with relevant failures, then scan again after changes.",
  },
];
