import { z } from "zod";
export const AcpSandboxConfigSchema = z
  .object({
    baseUrl: z
      .string()
      .url()
      .max(2048)
      .refine((value) => {
        try {
          const url = new URL(value);
          return (
            url.protocol === "https:" &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash
          );
        } catch {
          return false;
        }
      }),
    sandboxAcknowledged: z.literal(true),
    tokenEnv: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
      .max(128),
    apiVersion: z.literal("2026-04-17"),
    testItems: z
      .array(z.object({ id: z.string().min(1).max(256) }).strict())
      .min(1)
      .max(20),
    currency: z.string().regex(/^[a-zA-Z]{3}$/),
    completedSessionId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,256}$/)
      .optional(),
  })
  .strict();
