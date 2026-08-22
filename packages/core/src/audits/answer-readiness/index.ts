// Answer Readiness — v2 taxonomy category (Plan 3, Task 7).
// Order mirrors docs/evidence/v2-audit-map.md so Task 11 can consume the list verbatim.

// One meta-description audit in the place of meta-description + meta-description-aeo (9.11).
export { MetaDescriptionAudit } from './meta-description';
export { MetaAuthorAudit } from './meta-author';
export { UniqueMetaAudit } from './unique-meta';
// One social-meta audit in the place of core-open-graph + og-site-name (4.8) + twitter-card (4.10).
export { CoreOpenGraphAudit } from './core-open-graph';
export { OgTypeAudit } from './og-type';
export { OgImageAltAudit } from './og-image-alt';
export { FaqSectionsAudit } from './faq-sections';
export { QuestionHeadingsAudit } from './question-headings';
export { FirstParagraphAnswersAudit } from './first-paragraph-answers';
export { DirectDefinitionsAudit } from './direct-definitions';
export { ComparisonTablesAudit } from './comparison-tables';
export { NumberedStepsAudit } from './numbered-steps';
export { SpecificNumbersAudit } from './specific-numbers';
// One freshness audit in the place of dates-on-content + last-updated-indicator (9.10).
export { DatesOnContentAudit } from './dates-on-content';
export { ContentWithoutClickthroughAudit } from './content-without-clickthrough';
export { NamedAuthorAudit } from './named-author';
export { AuthorSameAsAudit } from './author-same-as';
export { AuthorPageAudit } from './author-page';
export { AboutCredentialsAudit } from './about-credentials';
export { ExternalCitationsAudit } from './external-citations';
export { BrandNameAudit } from './brand-name';
export { TrustSignalsAudit } from './trust-signals';
export { ReviewSignalsAudit } from './review-signals';
export { PublicationDateAudit } from './publication-date';
export { LastModifiedSchemaAudit } from './last-modified-schema';
export { UniqueDataAudit } from './unique-data';
export { BlockquoteUsageAudit } from './blockquote-usage';
export { DescriptiveUrlsAudit } from './descriptive-urls';

import { MetaDescriptionAudit } from './meta-description';
import { MetaAuthorAudit } from './meta-author';
import { UniqueMetaAudit } from './unique-meta';
import { CoreOpenGraphAudit } from './core-open-graph';
import { OgTypeAudit } from './og-type';
import { OgImageAltAudit } from './og-image-alt';
import { FaqSectionsAudit } from './faq-sections';
import { QuestionHeadingsAudit } from './question-headings';
import { FirstParagraphAnswersAudit } from './first-paragraph-answers';
import { DirectDefinitionsAudit } from './direct-definitions';
import { ComparisonTablesAudit } from './comparison-tables';
import { NumberedStepsAudit } from './numbered-steps';
import { SpecificNumbersAudit } from './specific-numbers';
import { DatesOnContentAudit } from './dates-on-content';
import { ContentWithoutClickthroughAudit } from './content-without-clickthrough';
import { NamedAuthorAudit } from './named-author';
import { AuthorSameAsAudit } from './author-same-as';
import { AuthorPageAudit } from './author-page';
import { AboutCredentialsAudit } from './about-credentials';
import { ExternalCitationsAudit } from './external-citations';
import { BrandNameAudit } from './brand-name';
import { TrustSignalsAudit } from './trust-signals';
import { ReviewSignalsAudit } from './review-signals';
import { PublicationDateAudit } from './publication-date';
import { LastModifiedSchemaAudit } from './last-modified-schema';
import { UniqueDataAudit } from './unique-data';
import { BlockquoteUsageAudit } from './blockquote-usage';
import { DescriptiveUrlsAudit } from './descriptive-urls';

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
  NumberedStepsAudit,
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
  BlockquoteUsageAudit,
  DescriptiveUrlsAudit,
] as const;
