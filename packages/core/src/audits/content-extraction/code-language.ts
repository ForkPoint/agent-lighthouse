import type { AuditMeta, AuditResult } from "#core/types";
import { hiddenFromReaders } from "#core/dom-visibility";
import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import { weightForGrade } from "#core/scorer";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

export class CodeLanguageAudit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/code-language",
    category: "content-extraction",
    title: "Code blocks have language annotations",
    failureTitle: "Code blocks have language annotations",
    description:
      "The language-* class convention labels code blocks. HTML-to-Markdown converters such as Turndown can preserve that label in fenced output. This informative check does not establish an effect on AI answer quality.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/audits/content-extraction/code-language.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "Turndown can copy a language-* class from the code element into a Markdown fence label. This check measures that convention, not whether an AI agent interprets the code correctly. Other annotation conventions may work in other tools.",
      fix: "For compatibility with this convention, add a nonempty language-* class to each <code> element inside <pre>, such as language-javascript or language-python. A class on <pre>, lang-* or data-language is a different convention and does not satisfy this check.",
      code: '<pre><code class="language-javascript">\nconst response = await fetch("/api/data");\nconst data = await response.json();\n</code></pre>',
      effort: FixEffort.Trivial,
      docsUrl: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/code",
      tags: ["code", "language", "semantic", "html"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let totalCodeBlocks = 0;
    let annotatedBlocks = 0;

    for (const page of ctx.pages) {
      const $ = page.$;
      // Turndown fences a <pre> once and labels it from its first <code>, so
      // assess one code element per block, not every <code> inside it.
      $("pre").each((_, pre) => {
        if (hiddenFromReaders($, pre)) return;
        const el = $(pre)
          .find("code")
          .toArray()
          .find((code) => !hiddenFromReaders($, code));
        if (!el) return;
        totalCodeBlocks++;
        const classList = $(el).attr("class") ?? "";
        if (
          classList.split(/\s+/).some((token) => /^language-\S+$/.test(token))
        ) {
          annotatedBlocks++;
        }
      });
    }

    if (totalCodeBlocks === 0) {
      return this.notApplicable(
        "No code blocks found, so there are no language annotations to assess.",
        "Each <pre><code> element has a nonempty language-* class",
        "No <pre><code> elements",
      );
    }

    const allAnnotated = annotatedBlocks === totalCodeBlocks;
    const majorityAnnotated = annotatedBlocks > totalCodeBlocks / 2;

    if (allAnnotated) {
      return this.pass(
        `All ${totalCodeBlocks} code block(s) have language annotations.`,
        "Each <pre><code> element has a nonempty language-* class",
        `${annotatedBlocks}/${totalCodeBlocks} annotated code blocks`,
      );
    }

    if (majorityAnnotated) {
      return this.warn(
        `${annotatedBlocks}/${totalCodeBlocks} code block(s) have language annotations.`,
        "Each <pre><code> element has a nonempty language-* class",
        `${annotatedBlocks}/${totalCodeBlocks} annotated code blocks`,
        {
          priority: CheckPriority.Low,
          description:
            "Some code elements lack a nonempty language-* class. Turndown cannot derive a fence label from that convention on those elements. Other annotation conventions may work in other tools; this finding does not prove incorrect AI interpretation.",
          code: '<pre><code class="language-python">\nresult = requests.get("/api/data")\n</code></pre>',
        },
      );
    }

    return this.fail(
      `${annotatedBlocks}/${totalCodeBlocks} code block(s) have language annotations.`,
      "Each <pre><code> element has a nonempty language-* class",
      `${annotatedBlocks}/${totalCodeBlocks} annotated code blocks`,
      {
        priority: CheckPriority.Low,
        description:
          "Some code elements lack a nonempty language-* class. Turndown cannot derive a fence label from that convention on those elements. Other annotation conventions may work in other tools; this finding does not prove incorrect AI interpretation.",
        code: '<pre><code class="language-python">\nresult = requests.get("/api/data")\n</code></pre>',
      },
    );
  }
}
