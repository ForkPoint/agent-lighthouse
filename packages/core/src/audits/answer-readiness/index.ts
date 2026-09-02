// Answer Readiness — v2 taxonomy category (Plan 3, Task 7).
// Order mirrors docs/evidence/v2-audit-map.md so Task 11 can consume the list verbatim.

// One meta-description audit in the place of meta-description + meta-description-aeo (9.11).
export { MetaDescriptionAudit } from "./meta-description";
export { MetaAuthorAudit } from "./meta-author";
export { UniqueMetaAudit } from "./unique-meta";
// One social-meta audit in the place of core-open-graph + og-site-name (4.8) + twitter-card (4.10).
export { CoreOpenGraphAudit } from "./core-open-graph";
export { OgTypeAudit } from "./og-type";
export { OgImageAltAudit } from "./og-image-alt";
export { FaqSectionsAudit } from "./faq-sections";
export { QuestionHeadingsAudit } from "./question-headings";
export { FirstParagraphAnswersAudit } from "./first-paragraph-answers";
export { DirectDefinitionsAudit } from "./direct-definitions";
export { ComparisonTablesAudit } from "./comparison-tables";
export { SpecificNumbersAudit } from "./specific-numbers";
// One freshness audit in the place of dates-on-content + last-updated-indicator (9.10).
export { DatesOnContentAudit } from "./dates-on-content";
export { ContentWithoutClickthroughAudit } from "./content-without-clickthrough";
export { NamedAuthorAudit } from "./named-author";
export { AuthorSameAsAudit } from "./author-same-as";
export { AuthorPageAudit } from "./author-page";
export { AboutCredentialsAudit } from "./about-credentials";
export { ExternalCitationsAudit } from "./external-citations";
export { BrandNameAudit } from "./brand-name";
export { TrustSignalsAudit } from "./trust-signals";
// One social-proof audit in the place of review-signals + blockquote-usage (10.14).
export { ReviewSignalsAudit } from "./review-signals";
export { PublicationDateAudit } from "./publication-date";
export { LastModifiedSchemaAudit } from "./last-modified-schema";
export { UniqueDataAudit } from "./unique-data";
export { DescriptiveUrlsAudit } from "./descriptive-urls";

// New in v2 (Plan 5): graduated from the proposal backlog on 2026-08-22.
export { SnippetGateCoverageAudit } from "./snippet-gate-coverage";
export { TextFragmentAddressabilityAudit } from "./text-fragment-addressability";
export { ChunkBoundaryReferentIntegrityAudit } from "./chunk-boundary-referent-integrity";
export { ExtractorSurvivalRecallAudit } from "./extractor-survival-recall";
export { SectionSplitRiskProfileAudit } from "./section-split-risk-profile";
export { SiteWidePassageUniquenessRatioAudit } from "./site-wide-passage-uniqueness-ratio";
export { TableMarkdownRoundTripLossAudit } from "./table-markdown-round-trip-loss";

import { MetaDescriptionAudit } from "./meta-description";
import { MetaAuthorAudit } from "./meta-author";
import { UniqueMetaAudit } from "./unique-meta";
import { CoreOpenGraphAudit } from "./core-open-graph";
import { OgTypeAudit } from "./og-type";
import { OgImageAltAudit } from "./og-image-alt";
import { FaqSectionsAudit } from "./faq-sections";
import { QuestionHeadingsAudit } from "./question-headings";
import { FirstParagraphAnswersAudit } from "./first-paragraph-answers";
import { DirectDefinitionsAudit } from "./direct-definitions";
import { ComparisonTablesAudit } from "./comparison-tables";
import { SpecificNumbersAudit } from "./specific-numbers";
import { DatesOnContentAudit } from "./dates-on-content";
import { ContentWithoutClickthroughAudit } from "./content-without-clickthrough";
import { NamedAuthorAudit } from "./named-author";
import { AuthorSameAsAudit } from "./author-same-as";
import { AuthorPageAudit } from "./author-page";
import { AboutCredentialsAudit } from "./about-credentials";
import { ExternalCitationsAudit } from "./external-citations";
import { BrandNameAudit } from "./brand-name";
import { TrustSignalsAudit } from "./trust-signals";
import { ReviewSignalsAudit } from "./review-signals";
import { PublicationDateAudit } from "./publication-date";
import { LastModifiedSchemaAudit } from "./last-modified-schema";
import { UniqueDataAudit } from "./unique-data";
import { DescriptiveUrlsAudit } from "./descriptive-urls";
import { SnippetGateCoverageAudit } from "./snippet-gate-coverage";
import { TextFragmentAddressabilityAudit } from "./text-fragment-addressability";
import { ChunkBoundaryReferentIntegrityAudit } from "./chunk-boundary-referent-integrity";
import { ExtractorSurvivalRecallAudit } from "./extractor-survival-recall";
import { SectionSplitRiskProfileAudit } from "./section-split-risk-profile";
import { SiteWidePassageUniquenessRatioAudit } from "./site-wide-passage-uniqueness-ratio";
import { TableMarkdownRoundTripLossAudit } from "./table-markdown-round-trip-loss";

/** Every audit that lives in the answer-readiness category, in map order. */
export const ANSWER_READINESS_AUDITS = [
  MetaDescriptionAudit,
  MetaAuthorAudit,
  UniqueMetaAudit,
  CoreOpenGraphAudit,
  OgTypeAudit,
  OgImageAltAudit,
  FaqSectionsAudit,
  QuestionHeadingsAudit,
  FirstParagraphAnswersAudit,
  DirectDefinitionsAudit,
  ComparisonTablesAudit,
  SpecificNumbersAudit,
  DatesOnContentAudit,
  ContentWithoutClickthroughAudit,
  NamedAuthorAudit,
  AuthorSameAsAudit,
  AuthorPageAudit,
  AboutCredentialsAudit,
  ExternalCitationsAudit,
  BrandNameAudit,
  TrustSignalsAudit,
  ReviewSignalsAudit,
  PublicationDateAudit,
  LastModifiedSchemaAudit,
  UniqueDataAudit,
  DescriptiveUrlsAudit,
  SnippetGateCoverageAudit,
  TextFragmentAddressabilityAudit,
  ChunkBoundaryReferentIntegrityAudit,
  ExtractorSurvivalRecallAudit,
  SectionSplitRiskProfileAudit,
  SiteWidePassageUniquenessRatioAudit,
  TableMarkdownRoundTripLossAudit,
] as const;
