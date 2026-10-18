import type { DeprecationNotice } from "#core/types";
import { NoticeKind } from "#core/types";

/**
 * The public notice every llms.txt audit carries. llms.txt is live — sites
 * publish it and user-pointed tools read it — but no AI vendor documents
 * fetching it from a website, so the family reports and never warns or fails
 * (docs/evidence/policy.md, "Informative or obsolete").
 */
export const LLMS_TXT_NOTICE: DeprecationNotice = {
  kind: NoticeKind.Unconsumed,
  notice:
    "No AI vendor documents reading llms.txt or llms-full.txt from a website. In a 137,210-domain study, 97% of llms.txt files received no requests in a month, and AI tools never requested a missing one.",
  link: "https://ahrefs.com/blog/llmstxt-study/",
};

/** Appended to every message that names a defect in llms.txt. */
export const LLMS_TXT_NO_EFFECT =
  "No AI vendor documents reading llms.txt, so this does not affect AI agents.";

/** The same sentence for llms-full.txt. */
export const LLMS_FULL_TXT_NO_EFFECT =
  "No AI vendor documents reading llms-full.txt, so this does not affect AI agents.";
