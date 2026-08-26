import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { isSafeUrl } from '../../fetcher';
import { registrableDomain } from '../../gatherers/domains';
import { discoverMcpEndpoint, isObject, tryParseJson } from './_mcp-client';

/** The public registry clients resolve "the MCP server for this domain" against. */
const REGISTRY = 'https://registry.modelcontextprotocol.io/v0.1/servers';

/** The file that proves control of a reverse-DNS namespace. */
const PROOF_PATH = '/.well-known/mcp-registry-auth';

/** The grammar that proof file must carry. */
const PROOF_GRAMMAR = /^v=MCPv1;\s*k=(ed25519|ecdsap384);\s*p=[A-Za-z0-9+/]+={0,2}\s*$/;

/** Search calls per scan. Each is a query to somebody else's registry. */
const MAX_SEARCHES = 2;

export type Namespace = 'first-party' | 'github-account' | 'aggregator';

/** Which kind of namespace does this server name sit in? */
export function namespaceKind(name: string, apex: string): Namespace {
  const reverse = apex.split('.').reverse().join('.');
  if (name.toLowerCase().startsWith(`${reverse.toLowerCase()}/`)) return 'first-party';
  if (/^io\.github\.[^/]+\//i.test(name)) return 'github-account';
  return 'aggregator';
}

interface Listing {
  name: string;
  version: string;
  remotes: Array<{ type: string; url: string }>;
  status: string;
  isLatest: boolean;
}

/** Read the listings out of a registry search response. */
export function parseListings(body: string): Listing[] {
  const parsed = tryParseJson(body);
  if (!isObject(parsed) || !Array.isArray(parsed['servers'])) return [];

  const out: Listing[] = [];
  for (const entry of parsed['servers'] as unknown[]) {
    if (!isObject(entry)) continue;
    const server = isObject(entry['server']) ? entry['server'] : entry;
    const meta = isObject(entry['_meta']) ? entry['_meta'] : {};
    const official = isObject(meta['io.modelcontextprotocol.registry/official'])
      ? (meta['io.modelcontextprotocol.registry/official'] as Record<string, unknown>)
      : {};
    const remotes = Array.isArray(server['remotes']) ? server['remotes'] : [];

    out.push({
      name: typeof server['name'] === 'string' ? server['name'] : '',
      version: typeof server['version'] === 'string' ? server['version'] : '',
      remotes: remotes
        .filter(isObject)
        .map((remote) => ({
          type: typeof remote['type'] === 'string' ? remote['type'] : '',
          url: typeof remote['url'] === 'string' ? remote['url'] : '',
        }))
        .filter((remote) => remote.url !== ''),
      status: typeof official['status'] === 'string' ? official['status'] : '',
      isLatest: official['isLatest'] === true,
    });
  }
  return out;
}

/** Does this remote URL live on the audited domain? */
function remoteBelongsTo(url: string, apex: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === apex || host.endsWith(`.${apex}`);
  } catch {
    return false;
  }
}

export class McpRegistryListingOwnershipAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/mcp-registry-listing-ownership',
    category: 'agent-interfaces',
    title: 'The MCP server is listed in the official registry under a namespace this domain owns',
    failureTitle: 'This site’s MCP server is missing from the registry, or listed under a namespace it does not own',
    description:
      'Searches the official MCP Registry for servers whose `remotes[].url` lives on this domain, classifies each listing by namespace — reverse-DNS of this domain, an individual’s GitHub account, or a third-party aggregator — and checks that the domain-control proof the reverse-DNS namespace requires is actually being served at `/.well-known/mcp-registry-auth`.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'medium',
    dossier: 'docs/evidence/audits/agent-interfaces/mcp-registry-listing-ownership.md',
    requires: ['origin-reachable'],
    guidance: {
      impact:
        'The registry is the index a client resolves "the MCP server for this domain" against. A domain with no first-party entry is absent from it, so the only path to the server is a URL somebody pastes by hand. A listing under an aggregator’s namespace is worse than absent in one way: the brand cannot update or revoke it, and agents routed through it reach a proxy rather than the origin. The reverse-DNS namespace that fixes this is granted on proof of domain control, and that proof has to keep being served.',
      fix: 'Publish the server under your own reverse-DNS namespace (`com.example/...`), serve the proof at `/.well-known/mcp-registry-auth` in the exact `v=MCPv1; k=ed25519; p=<base64>` form and keep serving it after DNS migrations, keep the listing’s version in step with what the server reports, and offer a `streamable-http` remote rather than only the deprecated `sse`.',
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/agent-interfaces/mcp-registry-listing-ownership/',
      tags: ['mcp', 'registry', 'namespace', 'discovery'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const endpoint = discoverMcpEndpoint(ctx);
    if (!endpoint || !endpoint.url) {
      return this.notApplicable(
        'This site declares no MCP endpoint, so there is no server to look for in the registry.',
        'A declared MCP endpoint with a registry listing under a namespace this domain owns',
        endpoint ? `Malformed declaration (${endpoint.source})` : 'No declared MCP endpoint',
      );
    }

    let apex: string;
    try {
      apex = registrableDomain(new URL(ctx.baseUrl).hostname);
    } catch {
      return this.notApplicable(
        'This scan carries no domain to search the registry for.',
        'An absolute base URL',
        `baseUrl: "${ctx.baseUrl}"`,
      );
    }

    const brand = apex.split('.')[0] ?? apex;
    const terms = [...new Set([apex, brand])].slice(0, MAX_SEARCHES);
    const listings: Listing[] = [];
    let searched = 0;

    for (const term of terms) {
      const url = `${REGISTRY}?search=${encodeURIComponent(term)}`;
      if (!(await isSafeUrl(url))) continue;
      searched += 1;
      const response = await ctx.fetch({ url, acceptHeader: 'application/json' });
      if (response.status !== 200) continue;
      for (const listing of parseListings(response.body)) {
        // The join key is the remote host, never the name: a name is whatever
        // the person who registered it chose.
        if (!listing.remotes.some((remote) => remoteBelongsTo(remote.url, apex))) continue;
        if (!listings.some((seen) => seen.name === listing.name)) listings.push(listing);
      }
    }

    const failures: string[] = [];
    const warnings: string[] = [];
    const found: string[] = [];

    const firstParty = listings.filter((listing) => namespaceKind(listing.name, apex) === 'first-party');
    for (const listing of listings) {
      const kind = namespaceKind(listing.name, apex);
      found.push(`${listing.name} (${kind}, ${listing.version || 'no version'}, ${listing.status || 'no status'})`);

      if (kind === 'aggregator') {
        const proxying = listing.remotes
          .filter((remote) => !remoteBelongsTo(remote.url, apex))
          .map((remote) => {
            try {
              return new URL(remote.url).host;
            } catch {
              return remote.url;
            }
          });
        warnings.push(
          `${listing.name} is a third-party listing this domain cannot update or revoke${proxying.length > 0 ? `, proxying through ${[...new Set(proxying)].join(', ')}` : ''}`,
        );
      } else if (kind === 'github-account') {
        warnings.push(`${listing.name} is bound to an individual's GitHub account rather than to this domain`);
      }

      if (listing.status !== '' && listing.status !== 'active') {
        warnings.push(`${listing.name} has registry status "${listing.status}"`);
      }
      if (!listing.isLatest && listing.status === 'active') {
        warnings.push(`${listing.name} is not the latest version in the registry`);
      }
      if (listing.remotes.length > 0 && !listing.remotes.some((remote) => remote.type === 'streamable-http')) {
        warnings.push(`${listing.name} offers only ${listing.remotes.map((r) => r.type || 'untyped').join(', ')} transport`);
      }
    }

    // The ownership proof, verified independently of what the registry says.
    let proof = '';
    const proofUrl = `https://${apex}${PROOF_PATH}`;
    // Fetched rather than read from `ctx.rootFiles`: the proof belongs to the
    // apex, and a scan of `www.example.com` collects root files for the www
    // host, not for the apex the registry namespace is bound to.
    const proofResult = (await isSafeUrl(proofUrl)) ? await ctx.fetch({ url: proofUrl }) : undefined;
    if (proofResult && proofResult.status === 200) {
      const line = proofResult.body.split(/\r?\n/).find((candidate) => candidate.trim() !== '') ?? '';
      proof = PROOF_GRAMMAR.test(line.trim()) ? 'valid' : 'malformed';
    } else {
      proof = 'absent';
    }

    if (listings.length === 0) {
      failures.push(
        `No registry listing names a server on ${apex}, so a client resolving "the MCP server for ${apex}" finds nothing`,
      );
    } else if (firstParty.length > 0 && proof !== 'valid') {
      failures.push(
        `${firstParty[0]!.name} claims a namespace granted on proof of domain control, but ${proofUrl} is ${proof}`,
      );
    } else if (firstParty.length === 0 && listings.some((l) => namespaceKind(l.name, apex) === 'aggregator')) {
      // Only the aggregator case fails here. A `io.github.<user>` listing is at
      // least held by somebody who can update it; an aggregator republish is
      // held by a party the brand has no relationship with, so it is the one
      // that leaves the domain unable to update or revoke its own entry.
      failures.push(
        `${apex} has no first-party registry listing: every entry pointing at this domain sits in a namespace a third party controls`,
      );
    }

    const details = {
      apex,
      searchesSent: searched,
      listings: found.slice(0, 10),
      firstPartyListings: firstParty.length,
      ownershipProof: proof,
      failures: failures.slice(0, 10),
      warnings: warnings.slice(0, 10),
    };
    const expected =
      'At least one registry listing under this domain’s reverse-DNS namespace, with the ownership proof served and a streamable-http remote';
    const foundText = `${listings.length} listing(s) pointing at ${apex}, ${firstParty.length} first-party; ownership proof ${proof}.`;
    const displayValue = `${firstParty.length} first-party listing(s)`;

    if (failures.length > 0) {
      return {
        ...this.fail(
          failures[0]!,
          expected,
          foundText,
          'Register the server under your own reverse-DNS namespace and keep serving the proof at /.well-known/mcp-registry-auth.',
        ),
        displayValue,
        details,
      };
    }

    if (warnings.length > 0) {
      return {
        ...this.warn(
          warnings[0]!,
          expected,
          foundText,
          'Keep the listing current and offer a streamable-http remote alongside anything deprecated.',
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `${apex} is listed in the official registry under a namespace it owns, with the proof served.`,
        expected,
        foundText,
      ),
      displayValue,
      details,
    };
  }
}
