import { z } from "zod";

export const timezoneSchema = z
  .string()
  .optional()
  .describe("IANA timezone (e.g. America/New_York). Defaults to UTC.");

export const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);
