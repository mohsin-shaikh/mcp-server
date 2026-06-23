import { z } from "zod";
import type { McpModule } from "../../registry/types.js";
import { formatTimeoutError, formatUpstreamError } from "../../lib/errors.js";
import { truncate } from "../../lib/format.js";
import { listOperations, parseOpenApiSpec, buildOperationRequest } from "../../lib/openapi.js";
import { toolError, toolJson, toolText } from "../../lib/result.js";
import { wrapToolHandler } from "../../lib/tool.js";

interface CachedSpec {
  spec: ReturnType<typeof parseOpenApiSpec>;
  fetchedAt: number;
}

const specCache = new Map<string, CachedSpec>();

async function fetchSpec(
  ctx: {
    config: { httpTimeoutMs: number; openapiCacheTtlMs: number };
    http: { fetch: typeof fetch };
    isHostAllowed: (url: string) => boolean;
  },
  specUrl: string,
): Promise<ReturnType<typeof parseOpenApiSpec>> {
  if (!ctx.isHostAllowed(specUrl)) {
    throw new Error("Spec URL host not in HTTP_TOOL_ALLOWED_HOSTS allowlist.");
  }

  const cached = specCache.get(specUrl);
  if (cached && Date.now() - cached.fetchedAt < ctx.config.openapiCacheTtlMs) {
    return cached.spec;
  }

  const res = await ctx.http.fetch(specUrl, {
    signal: AbortSignal.timeout(ctx.config.httpTimeoutMs),
  });
  if (!res.ok) {
    throw new Error(formatUpstreamError(res.status, specUrl));
  }

  const raw = (await res.json()) as unknown;
  const spec = parseOpenApiSpec(raw);
  specCache.set(specUrl, { spec, fetchedAt: Date.now() });
  return spec;
}

function resolveSpecUrl(provided: string | undefined, defaultUrl: string | undefined): string {
  const url = provided ?? defaultUrl;
  if (!url) {
    throw new Error("specUrl is required (or set OPENAPI_SPEC_URL)");
  }
  return url;
}

export const openapiModule: McpModule = {
  id: "openapi",
  name: "OpenAPI",
  readOnly: false,
  register(server, ctx) {
    server.registerTool(
      "openapi_list_operations",
      {
        title: "List OpenAPI operations",
        description: "Fetch an OpenAPI 3 spec and list operationIds with method and path.",
        inputSchema: z.object({
          specUrl: z.string().url().optional().describe("OpenAPI spec URL"),
        }),
        annotations: { readOnlyHint: true },
      },
      wrapToolHandler(ctx, "openapi_list_operations", async ({ specUrl }) => {
        try {
          const url = resolveSpecUrl(specUrl, ctx.config.openapiSpecUrl);
          const spec = await fetchSpec(ctx, url);
          const operations = listOperations(spec).map((op) => ({
            operationId: op.operationId,
            method: op.method,
            path: op.path,
            summary: op.summary,
            hasRequestBody: op.hasRequestBody,
          }));
          return toolJson({ specUrl: url, operations });
        } catch (err) {
          return toolError(err);
        }
      }),
    );

    server.registerTool(
      "openapi_call",
      {
        title: "Call OpenAPI operation",
        description: "Invoke an operation from an OpenAPI 3 spec by operationId.",
        inputSchema: z.object({
          operationId: z.string(),
          specUrl: z.string().url().optional(),
          baseUrl: z.string().url().optional(),
          pathParams: z.record(z.string(), z.string()).optional(),
          query: z.record(z.string(), z.string()).optional(),
          body: z.string().optional(),
          headers: z.record(z.string(), z.string()).optional(),
        }),
        annotations: { destructiveHint: true },
      },
      wrapToolHandler(
        ctx,
        "openapi_call",
        async ({ operationId, specUrl, baseUrl, pathParams, query, body, headers }) => {
          try {
            const url = resolveSpecUrl(specUrl, ctx.config.openapiSpecUrl);
            const spec = await fetchSpec(ctx, url);
            const request = buildOperationRequest(spec, operationId, {
              baseUrl,
              pathParams,
              query,
              body,
              headers,
            });

            if (!ctx.isHostAllowed(request.url)) {
              return toolError("API host not in HTTP_TOOL_ALLOWED_HOSTS allowlist.");
            }

            const res = await ctx.http.fetch(request.url, {
              method: request.method,
              headers: request.headers,
              body: request.body,
              signal: AbortSignal.timeout(ctx.config.httpTimeoutMs),
            });

            const text = truncate(await res.text(), ctx.config.httpMaxBytes);
            if (!res.ok) {
              return toolError(formatUpstreamError(res.status, request.url));
            }
            return toolText(`Status: ${res.status}\n\n${text}`);
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
