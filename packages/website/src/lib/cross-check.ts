/**
 * Fail the build when the registry and the dossier set disagree.
 *
 * `scripts/check-dossiers.mjs` enforces the same rule in CI. It runs again
 * here because this is the moment a page is about to be generated: a missing
 * dossier would ship an audit with no evidence, and an orphan dossier would
 * ship a page for an audit nobody can run.
 */
export function crossCheck(registryIds: string[], dossierIds: string[]): void {
  const registry = new Set(registryIds);
  const dossiers = new Set(dossierIds);
  const missing = registryIds.filter((id) => !dossiers.has(id));
  const orphans = dossierIds.filter((id) => !registry.has(id));
  if (missing.length === 0 && orphans.length === 0) return;

  const parts: string[] = [];
  if (missing.length > 0) parts.push(`audits with no dossier: ${missing.join(', ')}`);
  if (orphans.length > 0) parts.push(`dossiers with no audit: ${orphans.join(', ')}`);
  throw new Error(`Registry and dossier set disagree — ${parts.join('; ')}`);
}
