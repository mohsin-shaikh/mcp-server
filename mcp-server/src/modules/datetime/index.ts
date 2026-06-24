import { z } from "zod";
import type { McpModule } from "../../registry/types.js";
import { timezoneSchema } from "../../lib/schema.js";
import { toolError, toolJson } from "../../lib/result.js";
import { wrapToolHandler } from "../../lib/tool.js";

function formatInTimezone(date: Date, timezone?: string): string {
  if (!timezone) {
    return date.toISOString();
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

export const datetimeModule: McpModule = {
  id: "datetime",
  name: "Datetime",
  readOnly: true,
  register(server, ctx) {
    server.registerTool(
      "datetime_now",
      {
        title: "Current datetime",
        description: "Returns the current time in ISO 8601 and optional timezone.",
        inputSchema: z.object({
          timezone: timezoneSchema,
        }),
        annotations: { readOnlyHint: true },
      },
      wrapToolHandler(ctx, "datetime_now", async ({ timezone }) => {
        const now = new Date();
        return toolJson({
          iso: now.toISOString(),
          unixMs: now.getTime(),
          timezone: timezone ?? "UTC",
          formatted: formatInTimezone(now, timezone),
        });
      }),
    );

    server.registerTool(
      "datetime_format",
      {
        title: "Format datetime",
        description: "Parse an ISO date string and format it for display.",
        inputSchema: z.object({
          input: z.string().describe("ISO 8601 date string"),
          timezone: timezoneSchema,
        }),
        annotations: { readOnlyHint: true },
      },
      wrapToolHandler(ctx, "datetime_format", async ({ input, timezone }) => {
        const parsed = new Date(input);
        if (Number.isNaN(parsed.getTime())) {
          return toolError("Invalid date string. Use ISO 8601 format.");
        }

        return toolJson({
          input,
          iso: parsed.toISOString(),
          unixMs: parsed.getTime(),
          timezone: timezone ?? "UTC",
          formatted: formatInTimezone(parsed, timezone),
        });
      }),
    );
  },
};
