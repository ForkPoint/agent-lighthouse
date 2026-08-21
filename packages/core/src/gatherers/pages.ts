import type { CheckContext, PageContext } from '../check-context';
import type { PageType } from '../types';

export function pagesOfType(ctx: CheckContext, ...types: PageType[]): PageContext[] {
  // Copy, never the live array: callers sort/splice their result.
  if (types.length === 0) return [...ctx.pages];
  const wanted = new Set(types);
  return ctx.pages.filter((p) => wanted.has(p.pageType));
}

export interface PageJudgement {
  page: PageContext;
  ok: boolean;
  detail?: string;
}

/**
 * Run one judgement over a set of pages. v1 audits frequently judged only
 * pages[0] and generalized to the whole site; this makes per-page judgement
 * the path of least resistance. Callers MUST return notApplicable when
 * `judged.length === 0` — an empty set proves nothing.
 */
export function judgePages(
  pages: PageContext[],
  judge: (page: PageContext) => { ok: boolean; detail?: string },
): { judged: PageJudgement[]; passRate: number; failures: PageJudgement[] } {
  // `page` last: a judge returning a stray `page` key must not shadow the real one.
  const judged = pages.map((page) => ({ ...judge(page), page }));
  const failures = judged.filter((j) => !j.ok);
  const passRate = judged.length === 0 ? 1 : (judged.length - failures.length) / judged.length;
  return { judged, passRate, failures };
}
