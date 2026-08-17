export { buildReportView } from './view-model';
export type {
  ReportView,
  GroupView,
  CategoryView,
  CoverageView,
  CheckCounts,
  BuildReportViewOptions,
} from './view-model';
export { generateScanSummary } from './summary';
export { hydrateReport } from './hydrate';
export { SECTION_GROUPS, SECTION_GROUP_LABELS, CATEGORY_ORDER } from './sections';
export type { SectionGroupDef } from './sections';
export { generateHtmlReport } from './html-generator';
export { generateMarkdownSummary } from './markdown-generator';
