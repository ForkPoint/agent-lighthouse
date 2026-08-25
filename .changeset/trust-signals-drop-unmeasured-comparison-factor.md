---
"@forkpoint/agent-lighthouse-core": major
---

`answer-readiness/trust-signals` no longer counts comparison content toward its score. The audit now scores exactly the two page factors the study behind it measured: quantified social proof, and claims paired with evidence.

The audit's own evidence table gave the third factor, comparison content, the measured effect "named in the paper's practical implications" — a sentence in a discussion section, with no odds ratio and no model count, sitting beside two rows carrying OR 2.14 (significant in 4 of 6 models) and OR 2.09 (5 of 6). The project had already researched that signal separately for `answer-readiness/comparison-tables` and recorded "Consumers: none-known · Recommended tier: informative", where it ships at weight 0. The same page fact was being priced at two grades at once, and under the old "2 of 3" rule the unmeasured one could decide a pass.

The pass bar moves with the factor list. A pass now means both measured factors are present, a warning means one, and a failure means neither. A homepage that passed on a comparison table plus one measured factor will now warn, and a homepage whose only signal was a comparison table or an "X vs Y" heading will now fail instead of warning. Overall, answer-readiness and content-readiness scores fall for those sites. Homepages that already carried a quantified rating or review count together with outbound citations or attributed sources are unaffected, and no page that was passing on the two measured factors changes.

The evidence grade is unchanged at B, the audit stays scored at weight 0.6, and the deferral to `answer-readiness/review-signals` is unchanged: publishing valid Review or AggregateRating markup still removes the social-proof factor from both sides of the tally, so correct markup can never lower a homepage's result. Comparison content continues to be reported, unscored, by `answer-readiness/comparison-tables`.
