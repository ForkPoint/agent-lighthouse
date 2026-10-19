import type { AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import { parseRobotsFile, hasNamedGroup } from "#core/gatherers/robots";
import { CheckPriority } from "#core/types";

/**
 * Base for obsolete-tier robots.txt checks: a `User-agent` group whose rules
 * the named crawler's operator documents not reading.
 *
 * The owner wrote the group to control that crawler, so the report tells
 * them it does not. A site with no such group has nothing to hear, so every
 * other state is `notApplicable`, including a catch-all that happens to
 * cover the token. Access through the catch-all is the business of the other
 * per-bot audits, not of this one.
 */
export abstract class ObsoleteRobotsGroupAudit extends Audit {
  /** The product token the group names, as written in robots.txt. */
  protected abstract readonly token: string;
  /** Why the group has no effect, in one or two sentences, with the source. */
  protected abstract readonly reason: string;

  audit(ctx: CheckContext): AuditResult {
    const { token } = this;
    const robotsFile = ctx.rootFiles["/robots.txt"];
    const expected = `No User-agent: ${token} group: its operator documents not obeying one`;

    // Absent artifact, absent verdict: no robots.txt, a soft 404 or a file
    // with no group for this token is not a group the owner relies on.
    const groups =
      robotsFile && robotsFile.status === 200 && robotsFile.body
        ? parseRobotsFile(robotsFile.body).groups
        : [];
    if (!hasNamedGroup(groups, token)) {
      return this.notApplicable(
        `robots.txt has no User-agent: ${token} group, so there is nothing to retire.`,
        expected,
        robotsFile && robotsFile.status === 200
          ? `No User-agent: ${token} group`
          : "No robots.txt found",
      );
    }

    return this.warn(
      `robots.txt has a User-agent: ${token} group. ${this.reason}`,
      expected,
      `User-agent: ${token} group present`,
      CheckPriority.Low,
    );
  }
}
