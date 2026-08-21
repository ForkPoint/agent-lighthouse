import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "ai-crawler-edge-parity".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/competitor-gap-verify/ai-crawler-edge-parity.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Extend packages/core/src/fetcher.ts, which today hardcodes a single SCANNER_USER_AGENT, to accept
// a UA override and return raw status + headers + body. New audit
// packages/core/src/audits/crawler-permissions/edge-parity.ts consuming a new orchestrator
// artifact. Fold the existing waf-detector.ts (currently single-UA, so it only detects a WAF
// blocking US) into the baseline leg. Cost is ~6 extra requests per sampled URL; cap total probes
// and run them after the main crawl. IMPORTANT honesty constraint: we spoof the UA without the
// matching source IP, and OpenAI/Anthropic publish IP files (openai.com/gptbot.json,
// claude.com/crawling/bots.json) that a rigorous edge may verify by forward-confirmed reverse DNS.
// So a 403 to our spoofed UA can mean 'this edge does IP verification' rather than 'this edge
// blocks GPTBot'. Mitigate by reporting the finding as UA-STRING-BASED BLOCKING, downgrading to
// warn when the block page or headers indicate verification, and never failing when the baseline UA
// is also blocked (that is a scanner problem, not a site problem).
export class AiCrawlerEdgeParityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/competitor-gap-verify/ai-crawler-edge-parity',
    category: 'competitor-gap-verify',
    title: "ai-crawler-edge-parity",
    failureTitle: "ai-crawler-edge-parity",
    description: "Active differential fetching that reconciles what robots.txt PERMITS against what the CDN/WAF actually DOES. For the homepage plus up to 5 sitemap-selected URLs, issue paired GETs: a baseline with a current Chrome desktop UA, then one probe per AI product token using the exact documented UA strings (`Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot`, `Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)`, `Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)`, `Mozilla/5.0 ... ChatGPT-User/1.0; +https://openai.com/bot`, `Mozilla/5.0 ... OAI-SearchBot/1.0; +https://openai.com/searchbot`). Identical headers otherwise, no cookies, max 5 redirects, 10s timeout, sequential with jitter to avoid self-inflicted rate limiting. Compare four signals per probe: HTTP status; final URL host and path; block fingerprints (`cf-mitigated` header, `server: cloudflare` + 403, `x-datadome`/`x-dd-b`, `challenges.cloudflare.com` or `hcaptcha.com` in body, Akamai reference-error page); and normalized main-content text length after stripping script/style/nav/footer. FAIL-critical when robots.txt Allows the URL for token T yet the probe returns 401/403/429/503 or a block fingerprint while baseline returns 200 — a declared-policy/enforced-policy contradiction. FAIL-high when both return 200 but probe_text_len / baseline_text_len < 0.6 (soft cloak / content downgrade). FAIL-high on cross-host redirect or redirect to a path matching /(block|denied|captcha|challenge|are-you-human)/i. WARN when a 429 arrives without a Retry-After header. PASS requires every probe to match baseline status with a length ratio >= 0.9.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "robots.txt is a declaration parsed by the bot; the CDN is the enforcement layer and does not read it. Cloudflare auto-enrolled millions of zones in AI bot blocking, so the two layers disagree routinely and silently. Causal claim: if the origin returns 403 to a request bearing the GPTBot UA while returning 200 to a browser UA, GPTBot receives no content, regardless of what robots.txt says — so the site can pass every existing llms.txt, schema and robots audit while being wholly invisible to ChatGPT. Falsifiable per URL per token: the paired responses either agree or they do not.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/competitor-gap-verify/ai-crawler-edge-parity.md',
      tags: ['proposed', 'competitor-gap-verify'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/competitor-gap-verify/ai-crawler-edge-parity.md',
      'TODO stub',
    );
  }
}
