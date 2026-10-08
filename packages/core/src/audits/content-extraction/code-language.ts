import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import { weightForGrade } from "#core/scorer";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  PageType,
  ScoreDisplayMode,
} from "#core/types";

export class CodeLanguageAudit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/code-language",
    category: "content-extraction",
    title: "Code blocks have language annotations",
    failureTitle: "Code blocks have language annotations",
    description:
      "AI agents use language annotations on code blocks to apply the correct syntax understanding and provide accurate code explanations. Without them, agents must guess the programming language, which can lead to incorrect interpretations in AI-generated code answers.",
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
    applicablePageTypes: [PageType.Unknown, PageType.Article],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "AI agents use language annotations on code blocks to apply correct syntax highlighting and interpretation. Without language classes, agents must guess the programming language, leading to incorrect code explanations and potentially dangerous misinterpretations in AI-generated technical answers.",
      fix: 'Add a class attribute with a "language-" prefix to every <code> element inside <pre>. Use the standard language identifier (e.g., language-javascript, language-python, language-html). Most syntax highlighting libraries (Prism, Highlight.js) do this automatically.',
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
      $("pre code").each((_, el) => {
        totalCodeBlocks++;
        const classList = $(el).attr("class") ?? "";
        if (classList.includes("language-")) annotatedBlocks++;
      });
    }

    if (totalCodeBlocks === 0) {
      return this.warn(
        "No code blocks found — check may not apply to this site.",
        '<pre><code> elements have class containing "language-"',
        "No <pre><code> elements",
        {
          priority: CheckPriority.Low,
          description:
            "AI agents use language annotations on code blocks to apply the correct syntax understanding and provide accurate code explanations. Without them, agents must guess the programming language, which can lead to incorrect interpretations in AI-generated code answers.",
          code: '<pre><code class="language-javascript">\nconst result = await fetch("/api/data");\n</code></pre>',
        },
      );
    }

    const allAnnotated = annotatedBlocks === totalCodeBlocks;
    const majorityAnnotated = annotatedBlocks > totalCodeBlocks / 2;

    if (allAnnotated) {
      return this.pass(
        `All ${totalCodeBlocks} code block(s) have language annotations.`,
        'All <pre><code> elements have class containing "language-"',
        `${annotatedBlocks}/${totalCodeBlocks} annotated code blocks`,
      );
    }

    if (majorityAnnotated) {
      return this.warn(
        `${annotatedBlocks}/${totalCodeBlocks} code block(s) have language annotations.`,
        'All <pre><code> elements have class containing "language-"',
        `${annotatedBlocks}/${totalCodeBlocks} annotated code blocks`,
        {
          priority: CheckPriority.Low,
          description:
            "AI agents use language annotations to apply correct syntax understanding when extracting and explaining code from your pages. Unannotated code blocks force agents to guess the language, which often produces incorrect interpretations.",
          code: '<pre><code class="language-python">\nresult = requests.get("/api/data")\n</code></pre>',
        },
      );
    }

    return this.fail(
      `${annotatedBlocks}/${totalCodeBlocks} code block(s) have language annotations.`,
      'All <pre><code> elements have class containing "language-"',
      `${annotatedBlocks}/${totalCodeBlocks} annotated code blocks`,
      {
        priority: CheckPriority.Low,
        description:
          "AI agents use language annotations to apply correct syntax understanding when extracting and explaining code from your pages. Unannotated code blocks force agents to guess the language, which often produces incorrect interpretations.",
        code: '<pre><code class="language-python">\nresult = requests.get("/api/data")\n</code></pre>',
      },
    );
  }
}
