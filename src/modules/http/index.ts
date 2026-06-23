import { z } from "zod";
import type { McpModule } from "../../registry/types.js";
import { formatTimeoutError, formatUpstreamError } from "../../lib/errors.js";
import { truncate } from "../../lib/format.js";
import { toolError, toolText } from "../../lib/result.js";
import { wrapToolHandler } from "../../lib/tool.js";

const methodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export const httpModule: McpModule = {
  id: "http",
  name: "HTTP",
  readOnly: false,
  register(server, ctx) {
    server.registerTool(
      "http_fetch",
      {
        title: "HTTP fetch",
        description:
          "Fetch a URL with GET/POST/PUT/PATCH/DELETE. Only allowed hosts are permitted.",
        inputSchema: z.object({
          url: z.string().url(),
          method: methodSchema.default("GET"),
          headers: z.record(z.string(), z.string()).optional(),
          body: z.string().optional(),
        }),
        annotations: {
          destructiveHint: true,
        },
      },
      wrapToolHandler(
        ctx,
        "http_fetch",
        async (args) => {
          if (!ctx.isHostAllowed(args.url)) {
            return toolError("Host not in HTTP_TOOL_ALLOWED_HOSTS allowlist.");
          }

          try {
            const res = await ctx.http.fetch(args.url, {
              method: args.method,
              headers: args.headers,
              body: args.body,
              signal: AbortSignal.timeout(ctx.config.httpTimeoutMs),
            });

            const text = truncate(await res.text(), ctx.config.httpMaxBytes);
            const output = `Status: ${res.status} ${res.statusText}\n\n${text}`;

            if (!res.ok) {
              return toolError(formatUpstreamError(res.status, args.url));
            }
            return toolText(output);
          } catch (err) {
            if (err instanceof Error && err.name === "TimeoutError") {
              return toolError(formatTimeoutError(ctx.config.httpTimeoutMs));
            }
            return toolError(err);
          }
        },
        { mutating: true },
      ),
    );
  },
};
