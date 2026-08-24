import * as cheerio from 'cheerio';
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { isSafeUrl } from '../../fetcher';
import { directiveLines } from '../../gatherers/robots';
import { linksWithRel } from '../../gatherers/structured-fields';
import { isIso4217 } from '../../gatherers/currency';

/** The namespace the RSL 1.0 specification defines. */
const RSL_NAMESPACE = 'https://rslstandard.org/rsl';

/** The media type an RSL document is served and linked as. */
const RSL_TYPE = 'application/rsl+xml';

/** Enumerated attribute values the spec closes. */
const PERMIT_TYPES: ReadonlySet<string> = new Set(['usage', 'user', 'geo']);
const PAYMENT_TYPES: ReadonlySet<string> = new Set([
  'purchase',
  'subscription',
  'crawl',
  'use',
  'attribution',
  'free',
]);

/** Paths an RSL document conventionally lives at, though the spec mandates none. */
const CONVENTIONAL_PATHS = ['/license.xml', '/rsl.xml'];

/** Documents fetched. A site with more licence pointers than this has a different problem. */
const MAX_CANDIDATES = 3;

interface Candidate {
  url: string;
  /** How it was found, named the way the finding quotes it. */
  channel: string;
  /** True when only a conventional-path probe found it. */
  conventionalOnly: boolean;
  /** Inline documents carry their XML rather than a URL. */
  inlineXml?: string;
}

export class RslLicensingTermsConformanceAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/rsl-licensing-terms-conformance',
    category: 'access-crawl-control',
    title: 'RSL licensing terms are discoverable and conformant',
    failureTitle: 'This site’s machine-readable licence cannot be found or cannot be read',
    description:
      'Looks for an RSL licence in all four channels the specification defines — the robots.txt `License:` directive, a `Link: rel=license` response header, an HTML `<link>`, and an inline `<script type="application/rsl+xml">` — then validates the document: its namespace, its media type, the paths its `<content url>` covers, and the enumerated attributes on every permits, prohibits, payment and amount element.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'medium',
    dossier: 'docs/evidence/audits/access-crawl-control/rsl-licensing-terms-conformance.md',
    guidance: {
      impact:
        'RSL is the machine-readable form of "here are my terms". A crawler that cannot find the document applies its own defaults instead, and a document it finds but cannot parse is worth no more than one it never found. The specification mandates no default location, so a licence reachable only at a guessed path is one no crawler is obliged to look for. The quiet failure is a `<content url>` prefix that does not cover the pages the licence was written for: the terms load, parse, and apply to nothing.',
      fix: 'Point at the licence from robots.txt with an absolute `License:` URI, and add the `Link: <...>; rel="license"; type="application/rsl+xml"` response header so a crawler that never reads robots.txt still finds it. Serve the document as `application/rsl+xml`, keep the `https://rslstandard.org/rsl` namespace on the root element, and make every `<content url>` prefix cover the paths it licenses.',
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/access-crawl-control/rsl-licensing-terms-conformance/',
      tags: ['rsl', 'licensing', 'robots', 'headers'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const candidates: Candidate[] = [];
    const errors: string[] = [];
    const notes: string[] = [];

    const robots = ctx.rootFiles['/robots.txt'];
    const robotsBody = robots?.status === 200 ? robots.body : '';
    for (const line of directiveLines(robotsBody, 'license')) {
      // The spec says the value MUST be an absolute URI. Resolving a relative
      // one would hide the defect behind our own helpfulness.
      let absolute = false;
      try {
        absolute = new URL(line.value).protocol.startsWith('http');
      } catch {
        absolute = false;
      }
      if (!absolute) {
        errors.push(
          `robots.txt line ${line.line}: License: ${line.value} is not an absolute URI, which RSL requires`,
        );
        continue;
      }
      candidates.push({ url: line.value, channel: `robots.txt License: line ${line.line}`, conventionalOnly: false });
    }

    for (const page of ctx.pages) {
      const header = page.fetchResult.headers?.['link'] ?? '';
      for (const entry of linksWithRel(header, 'license')) {
        if ((entry.params['type'] ?? '').split(';')[0]!.trim().toLowerCase() !== RSL_TYPE) continue;
        try {
          candidates.push({
            url: new URL(entry.href, page.url).toString(),
            channel: `Link: rel=license header on ${page.url}`,
            conventionalOnly: false,
          });
        } catch {
          errors.push(`Link header on ${page.url} carries an unresolvable licence URL`);
        }
      }

      page.$('link[rel~="license"]').each((_i, el) => {
        const $el = page.$(el);
        if (($el.attr('type') ?? '').split(';')[0]!.trim().toLowerCase() !== RSL_TYPE) return;
        const href = $el.attr('href') ?? '';
        try {
          candidates.push({
            url: new URL(href, page.url).toString(),
            channel: `<link rel="license"> on ${page.url}`,
            conventionalOnly: false,
          });
        } catch {
          errors.push(`<link rel="license"> on ${page.url} carries an unresolvable href`);
        }
      });

      page.$(`script[type="${RSL_TYPE}"]`).each((_i, el) => {
        const xml = page.$(el).text();
        if (xml.trim() === '') return;
        candidates.push({
          url: page.url,
          channel: `inline <script type="${RSL_TYPE}"> on ${page.url}`,
          conventionalOnly: false,
          inlineXml: xml,
        });
      });
    }

    // Only probe the conventional paths when no channel advertised a licence.
    // Anything found this way is reported as present but not discoverable: the
    // spec mandates no default location, so no crawler must look there.
    if (candidates.length === 0) {
      for (const path of CONVENTIONAL_PATHS) {
        const url = new URL(path, ctx.baseUrl).toString();
        if (!(await isSafeUrl(url))) continue;
        const result = await ctx.fetch({ url, followRedirects: true });
        if (result.status !== 200 || result.body.trim() === '') continue;
        candidates.push({ url, channel: `probe of ${path}`, conventionalOnly: true });
      }
    }

    if (candidates.length === 0) {
      return this.notApplicable(
        'This site publishes no RSL licence in any channel the specification defines.',
        'An RSL licence in robots.txt, a Link header, an HTML link or an inline script',
        errors.length > 0 ? errors.join('; ') : 'No License: directive, licence link or inline RSL document',
      );
    }

    const seen = new Set<string>();
    const documents: Array<{ candidate: Candidate; xml: string; contentType: string }> = [];
    for (const candidate of candidates.slice(0, MAX_CANDIDATES)) {
      if (candidate.inlineXml !== undefined) {
        documents.push({ candidate, xml: candidate.inlineXml, contentType: RSL_TYPE });
        continue;
      }
      if (seen.has(candidate.url)) continue;
      seen.add(candidate.url);
      if (!(await isSafeUrl(candidate.url))) {
        errors.push(`${candidate.channel}: ${candidate.url} is not a URL this scanner will fetch`);
        continue;
      }
      const result = await ctx.fetch({ url: candidate.url, followRedirects: true });
      if (result.status !== 200) {
        errors.push(`${candidate.channel}: ${candidate.url} answered HTTP ${result.status}`);
        continue;
      }
      documents.push({
        candidate,
        xml: result.body,
        contentType: (result.headers['content-type'] ?? result.contentType ?? '').split(';')[0]!.trim().toLowerCase(),
      });
    }

    const auditedPaths = ctx.pages.map((page) => {
      try {
        return new URL(page.url).pathname;
      } catch {
        return '/';
      }
    });

    let valid = 0;
    for (const doc of documents) {
      const where = doc.candidate.channel;
      if (doc.contentType !== RSL_TYPE) {
        errors.push(`${where}: served as "${doc.contentType || 'no content type'}" rather than ${RSL_TYPE}`);
      }
      const $ = cheerio.load(doc.xml, { xmlMode: true });
      const root = $('rsl').first();
      if (root.length === 0) {
        errors.push(`${where}: root element is not <rsl>`);
        continue;
      }
      if ((root.attr('xmlns') ?? '') !== RSL_NAMESPACE) {
        errors.push(`${where}: root <rsl> carries xmlns "${root.attr('xmlns') ?? 'none'}", not ${RSL_NAMESPACE}`);
        continue;
      }

      const contents = $('content').toArray();
      if (contents.length === 0) {
        errors.push(`${where}: no <content url=…> element, so the licence covers nothing`);
        continue;
      }
      const prefixes = contents.map((el) => {
        const url = $(el).attr('url') ?? '/';
        try {
          return new URL(url, doc.candidate.url).pathname;
        } catch {
          return url;
        }
      });
      const uncovered = auditedPaths.filter((path) => !prefixes.some((prefix) => path.startsWith(prefix)));
      if (uncovered.length > 0) {
        errors.push(
          `${where}: <content url> covers ${prefixes.join(', ')}, which does not reach ${uncovered.slice(0, 3).join(', ')}`,
        );
      }

      const licences = $('license').toArray();
      if (licences.length === 0) {
        errors.push(`${where}: no <license> element`);
      }
      for (const licence of licences) {
        const $licence = $(licence);
        const terms = $licence.find('permits, prohibits, payment');
        if (terms.length === 0) {
          errors.push(`${where}: a <license> carries no permits, prohibits or payment`);
        }
        $licence.find('permits, prohibits').each((_i, el) => {
          const type = ($(el).attr('type') ?? '').toLowerCase();
          if (!PERMIT_TYPES.has(type)) {
            errors.push(`${where}: <${el.tagName} type="${type || 'missing'}"> is not one of usage, user, geo`);
          }
        });
        $licence.find('payment').each((_i, el) => {
          const type = ($(el).attr('type') ?? '').toLowerCase();
          if (!PAYMENT_TYPES.has(type)) {
            errors.push(
              `${where}: <payment type="${type || 'missing'}"> is not one of ${[...PAYMENT_TYPES].join(', ')}`,
            );
          }
        });
      }

      $('amount').each((_i, el) => {
        const currency = $(el).attr('currency') ?? '';
        if (!isIso4217(currency)) {
          errors.push(`${where}: <amount currency="${currency || 'missing'}"> is not an active ISO 4217 code`);
        }
        if (!/^\d+(\.\d+)?$/.test($(el).text().trim())) {
          errors.push(`${where}: <amount> value "${$(el).text().trim()}" does not parse as a decimal`);
        }
      });

      const copyright = $('copyright').first();
      if (copyright.length > 0 && !copyright.attr('contactEmail') && !copyright.attr('contactUrl')) {
        errors.push(`${where}: <copyright> carries neither contactEmail nor contactUrl`);
      }

      if (doc.candidate.conventionalOnly) {
        notes.push(
          `${doc.candidate.url} was found only by probing a conventional path; RSL mandates no default location, so no crawler is obliged to look there`,
        );
      }
      valid += 1;
    }

    const displayValue = `${documents.length} document(s), ${errors.length} problem(s)`;
    const expected =
      'An RSL licence advertised in a channel the spec defines, served as application/rsl+xml, with a valid namespace, covering content prefixes and conformant enumerations';
    const found = `${documents.length} RSL document(s) read from ${[...new Set(documents.map((d) => d.candidate.channel))].join('; ')}; ${errors.length} conformance problem(s).`;
    const details = {
      documents: documents.length,
      validDocuments: valid,
      channels: [...new Set(candidates.map((c) => c.channel))],
      conformanceErrors: errors.slice(0, 30),
      notes,
    };

    if (errors.length > 0) {
      return {
        ...this.fail(
          `${errors.length} problem(s) in this site’s RSL licensing.`,
          expected,
          found,
          'Serve the licence as application/rsl+xml with the RSL namespace, and make its <content url> prefixes cover the pages it licenses.',
        ),
        displayValue,
        details,
      };
    }

    if (notes.length > 0) {
      return {
        ...this.warn(
          'The RSL licence is present but not discoverable: only a guessed path found it.',
          expected,
          found,
          'Advertise it with a robots.txt `License:` directive or a `Link: rel=license` header.',
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `${documents.length} RSL document(s), advertised and conformant.`,
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
