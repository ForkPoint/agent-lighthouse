/**
 * The README badge generator's client half.
 *
 * The colour bands and the markdown form are `docs/BADGE.md`'s published
 * contract, restated here as code so the page and the doc cannot drift: the
 * bands are a single exported table that the page renders and the test pins.
 *
 * It imports nothing — no core, no registry, no fetch. Everything it needs is
 * a number and a URL the visitor typed, and every DOM node it writes is built
 * with `createElement`/`textContent`, never from an HTML string.
 */

/** One row of `docs/BADGE.md`'s score table. */
export interface BadgeBand {
  /** The lowest score in the band. */
  min: number;
  /** The highest score in the band. */
  max: number;
  /** The shields.io colour, without the `#`. */
  color: string;
  /** The label `docs/BADGE.md` gives the band. */
  meaning: string;
}

/**
 * The bands, highest first — the order `badgeColor` walks them in and the order
 * the page renders them in. Sorted descending so the lookup is a first match
 * rather than a chain of hand-written comparisons that can disagree with this
 * table.
 */
export const BADGE_BANDS: readonly BadgeBand[] = [
  { min: 90, max: 100, color: '22c55e', meaning: 'Agent-ready' },
  { min: 70, max: 89, color: '4f46e5', meaning: 'Good' },
  { min: 50, max: 69, color: 'f59e0b', meaning: 'Needs work' },
  { min: 0, max: 49, color: 'ef4444', meaning: 'Blocked' },
];

/** Where the badge links, exactly as `docs/BADGE.md` writes it. */
export const BADGE_LINK = 'https://github.com/ForkPoint/agent-lighthouse';

/** The score the generator opens on, and the one `docs/BADGE.md` illustrates. */
export const DEFAULT_SCORE = 87;

/** The site the generator opens on, a placeholder rather than a real target. */
export const DEFAULT_URL = 'https://example.com';

/**
 * A score reduced to the integer 0–100 a badge can carry.
 *
 * `<input type="number">` yields a string the visitor controls: it can be
 * empty, `1e400`, `-5`, or `NaN` once coerced. None of those belong in a URL,
 * so everything that is not a finite number lands on 0.
 */
export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** The shields.io colour for a score, per `docs/BADGE.md`'s table. */
export function badgeColor(score: number): string {
  const clamped = clampScore(score);
  // `BADGE_BANDS` is descending and its last band starts at 0, so the fallback
  // is unreachable for a clamped score; it is there so the return type is a
  // string rather than `string | undefined`.
  return BADGE_BANDS.find((band) => clamped >= band.min)?.color ?? 'ef4444';
}

/** The shields.io image URL for a score — the form `docs/BADGE.md` publishes. */
export function badgeImageUrl(score: number): string {
  const clamped = clampScore(score);
  return `https://img.shields.io/badge/Agent%20Lighthouse-${clamped}%2F100-${badgeColor(clamped)}`;
}

/**
 * The target URL, safe to sit inside an HTML comment.
 *
 * The generated markdown is text the visitor copies into their own README, so
 * a URL containing `-->` would close the comment early and spill the rest onto
 * the page they paste it into. Angle brackets are the only way to write that
 * sequence's ends, and no URL needs them unencoded.
 */
function commentSafe(url: string): string {
  return url.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * The badge, as markdown.
 *
 * The badge line is `docs/BADGE.md`'s form character for character: the same
 * shields.io URL, the same alt text, and the same link to the repository, which
 * is what tells a reader of somebody else's README what the number means. The
 * scanned site follows as a comment, so the copied snippet records what was
 * measured without adding a second visible link to the README it lands in.
 */
export function badgeMarkdown(score: number, url: string): string {
  const target = commentSafe(url) || DEFAULT_URL;
  return `[![Agent Lighthouse](${badgeImageUrl(score)})](${BADGE_LINK})\n<!-- Scanned: ${target} -->`;
}

/**
 * Bind the generator to the page. The only DOM-touching export.
 *
 * The page ships the default badge already rendered by the build, so this
 * replaces a correct snippet with another correct snippet rather than filling
 * in a blank: with scripting off the panel still shows a usable badge.
 */
export function mountBadgeGenerator(): void {
  const scoreInput = document.querySelector<HTMLInputElement>('#badge-score');
  const urlInput = document.querySelector<HTMLInputElement>('#badge-url');
  const preview = document.querySelector<HTMLElement>('#badge-preview');
  const markdown = document.querySelector<HTMLElement>('#badge-markdown');
  if (!scoreInput || !urlInput || !preview || !markdown) return;

  const update = (): void => {
    const score = clampScore(Number(scoreInput.value));
    const url = urlInput.value.trim() || DEFAULT_URL;

    // `textContent`, not `innerHTML`: the URL is whatever the visitor typed,
    // and the snippet is meant to be read as text anyway.
    markdown.textContent = badgeMarkdown(score, url);

    const image = document.createElement('img');
    // The src is assembled from a clamped integer and a colour out of
    // `BADGE_BANDS` — no part of it comes from the URL field.
    image.src = badgeImageUrl(score);
    image.alt = `Agent Lighthouse ${score}/100 badge`;
    image.height = 20;
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    preview.replaceChildren(image);
  };

  scoreInput.addEventListener('input', update);
  urlInput.addEventListener('input', update);

  const copy = document.querySelector<HTMLButtonElement>('#badge-copy');
  const status = document.querySelector<HTMLElement>('#badge-copy-status');
  if (copy) {
    copy.addEventListener('click', () => {
      // Feature-detected rather than assumed: the Clipboard API needs a secure
      // context, and a reader on plain http would otherwise get an unhandled
      // rejection and no explanation.
      void navigator.clipboard
        ?.writeText(markdown.textContent ?? '')
        .then(() => {
          if (status) status.textContent = 'Badge markdown copied to the clipboard.';
        })
        .catch(() => {
          if (status) status.textContent = 'Copying failed — select the snippet and copy it.';
        });
    });
    // Revealed only now that it works, the way the other islands reveal their
    // controls: a Copy button that does nothing is worse than no button.
    copy.hidden = false;
  }

  update();
}
