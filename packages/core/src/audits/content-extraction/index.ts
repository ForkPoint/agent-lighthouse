// Content Extraction — v2 taxonomy category (Plan 3, Task 4).
// Order mirrors docs/evidence/v2-audit-map.md so Task 11 can consume the list verbatim.

export { FastPageLoadAudit } from './server-responsiveness';
export { LanguageAttributeAudit } from './language-attribute';
export { MarkdownAlternateAudit } from './markdown-alternate';
export { SingleH1Audit } from './single-h1';
export { SequentialHeadingsAudit } from './sequential-headings';
export { MainElementAudit } from './main-element';
export { ArticleElementAudit } from './article-element';
export { HeaderFooterAudit } from './header-footer';
export { AsideElementAudit } from './aside-element';
export { SectionHeadingsAudit } from './section-headings';
export { SemanticListsAudit } from './semantic-lists';
export { DataTablesAudit } from './data-tables';
export { CodeLanguageAudit } from './code-language';
export { TimeElementAudit } from './time-element';
export { ContentDepthAudit } from './content-depth';
export { ImageAltTextAudit } from './image-alt-text';
export { FigureFigcaptionAudit } from './figure-figcaption';
export { SvgBloatAudit } from './svg-bloat';
export { TokenRatioAudit } from './token-ratio';
export { FakeHeadingsAudit } from './fake-headings';
export { FastResponseTimeAudit } from './fast-response-time';
export { ServerRenderedAudit } from './server-rendered';

import { FastPageLoadAudit } from './server-responsiveness';
import { LanguageAttributeAudit } from './language-attribute';
import { MarkdownAlternateAudit } from './markdown-alternate';
import { SingleH1Audit } from './single-h1';
import { SequentialHeadingsAudit } from './sequential-headings';
import { MainElementAudit } from './main-element';
import { ArticleElementAudit } from './article-element';
import { HeaderFooterAudit } from './header-footer';
import { AsideElementAudit } from './aside-element';
import { SectionHeadingsAudit } from './section-headings';
import { SemanticListsAudit } from './semantic-lists';
import { DataTablesAudit } from './data-tables';
import { CodeLanguageAudit } from './code-language';
import { TimeElementAudit } from './time-element';
import { ContentDepthAudit } from './content-depth';
import { ImageAltTextAudit } from './image-alt-text';
import { FigureFigcaptionAudit } from './figure-figcaption';
import { SvgBloatAudit } from './svg-bloat';
import { TokenRatioAudit } from './token-ratio';
import { FakeHeadingsAudit } from './fake-headings';
import { FastResponseTimeAudit } from './fast-response-time';
import { ServerRenderedAudit } from './server-rendered';

/** Every audit that lives in the content-extraction category, in map order. */
export const CONTENT_EXTRACTION_AUDITS = [
  FastPageLoadAudit,
  LanguageAttributeAudit,
  MarkdownAlternateAudit,
  SingleH1Audit,
  SequentialHeadingsAudit,
  MainElementAudit,
  ArticleElementAudit,
  HeaderFooterAudit,
  AsideElementAudit,
  SectionHeadingsAudit,
  SemanticListsAudit,
  DataTablesAudit,
  CodeLanguageAudit,
  TimeElementAudit,
  ContentDepthAudit,
  ImageAltTextAudit,
  FigureFigcaptionAudit,
  SvgBloatAudit,
  TokenRatioAudit,
  FakeHeadingsAudit,
  FastResponseTimeAudit,
  ServerRenderedAudit,
] as const;
