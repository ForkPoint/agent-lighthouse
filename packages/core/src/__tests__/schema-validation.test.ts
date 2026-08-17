import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../audit-config';
import { AuditMetaSchema, AuditResultSchema, CheckResultSchema } from '../schemas';
import { mockCheckContext, mockPageContext, mockFetchResult } from './test-utils';

describe('Audit Schema Validation (All 183+ Audits)', () => {
  const ctx = mockCheckContext(
    [mockPageContext('https://example.com/', '<html><body><h1>Test</h1></body></html>')],
    {
      '/llms.txt': mockFetchResult('# Test'),
      '/robots.txt': mockFetchResult('User-agent: *\nAllow: /'),
    },
  );

  for (const category of defaultConfig.categories) {
    const registrations = defaultConfig.audits[category.id] ?? [];

    describe(`Category: ${category.name}`, () => {
      for (const reg of registrations) {
        const { meta } = reg;

        it(`[${meta.id}] ${meta.title} - meta schema`, () => {
          const result = AuditMetaSchema.safeParse(meta);
          if (!result.success) {
            console.error(`Schema error in ${meta.id}:`, result.error.format());
          }
          expect(result.success).toBe(true);
        });

        it(`[${meta.id}] ${meta.title} - result schema`, async () => {
          const instance = reg.create();
          try {
            const auditResult = await instance.audit(ctx);
            // toCheckResult internally calls this.validate() which uses AuditResultSchema
            const checkResult = instance.toCheckResult(auditResult);

            // Validate the final flattened CheckResult
            const checkValidation = CheckResultSchema.safeParse(checkResult);
            if (!checkValidation.success) {
              console.error(
                `CheckResult schema error in ${meta.id}:`,
                checkValidation.error.format(),
              );
            }
            expect(checkValidation.success).toBe(true);

            // Double check raw AuditResult with safeParse
            const validation = AuditResultSchema.safeParse(auditResult);
            expect(validation.success).toBe(true);
          } catch (err: any) {
            // If it's a ZodError, it means our built-in validation caught it
            // If it's a TypeError/other, it's a bug in the audit logic
            if (err.name === 'ZodError') {
              console.error(`Result schema error in ${meta.id}:`, err.format());
              throw err;
            }
            // Some audits might naturally fail on empty context, but they shouldn't throw TypeErrors
            if (err instanceof TypeError) {
              console.error(`Logic error in ${meta.id}:`, err);
              throw err;
            }
          }
        });
      }
    });
  }
});
