export interface OpenApiSpec {
  openapi?: string;
  servers?: Array<{ url: string }>;
  paths?: Record<string, PathItem>;
}

interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenApiParameter[];
  requestBody?: unknown;
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  head?: Operation;
  options?: Operation;
}

export interface OpenApiParameter {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  required?: boolean;
  schema?: { type?: string };
}

export interface OpenApiOperation {
  operationId: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
  parameters?: OpenApiParameter[];
  hasRequestBody: boolean;
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

export function parseOpenApiSpec(raw: unknown): OpenApiSpec {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid OpenAPI spec: expected JSON object");
  }
  return raw as OpenApiSpec;
}

export function listOperations(spec: OpenApiSpec): OpenApiOperation[] {
  const operations: OpenApiOperation[] = [];

  for (const [routePath, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!pathItem || typeof pathItem !== "object") {
      continue;
    }

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation?.operationId) {
        continue;
      }

      operations.push({
        operationId: operation.operationId,
        method: method.toUpperCase(),
        path: routePath,
        summary: operation.summary,
        description: operation.description,
        parameters: operation.parameters,
        hasRequestBody: Boolean(operation.requestBody),
      });
    }
  }

  return operations.sort((a, b) => a.operationId.localeCompare(b.operationId));
}

export function getBaseUrl(spec: OpenApiSpec, override?: string): string {
  if (override) {
    return override.replace(/\/$/, "");
  }
  const url = spec.servers?.[0]?.url;
  if (!url) {
    throw new Error("OpenAPI spec has no servers; provide baseUrl");
  }
  return url.replace(/\/$/, "");
}

export function findOperation(
  spec: OpenApiSpec,
  operationId: string,
): OpenApiOperation | undefined {
  return listOperations(spec).find((op) => op.operationId === operationId);
}

export function buildOperationUrl(
  routePath: string,
  pathParams: Record<string, string> = {},
): string {
  return routePath.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = pathParams[key];
    if (!value) {
      throw new Error(`Missing path parameter: ${key}`);
    }
    return encodeURIComponent(value);
  });
}

export function buildOperationRequest(
  spec: OpenApiSpec,
  operationId: string,
  options: {
    baseUrl?: string;
    pathParams?: Record<string, string>;
    query?: Record<string, string>;
    body?: string;
    headers?: Record<string, string>;
  } = {},
): { url: string; method: string; headers: Record<string, string>; body?: string } {
  const operation = findOperation(spec, operationId);
  if (!operation) {
    throw new Error(`Unknown operationId: ${operationId}`);
  }

  const base = getBaseUrl(spec, options.baseUrl);
  const resolvedPath = buildOperationUrl(operation.path, options.pathParams);
  const url = new URL(`${base}${resolvedPath}`);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = { ...options.headers };
  const body = options.body;

  if (body && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  return {
    url: url.toString(),
    method: operation.method,
    headers,
    body,
  };
}
