export class McpToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpToolError";
  }
}

export function formatUpstreamError(status: number, url?: string): string {
  if (status === 401 || status === 403) {
    return "Authentication failed for upstream service";
  }
  if (status === 404) {
    return url ? `Resource not found: ${url}` : "Resource not found";
  }
  if (status === 429) {
    return "Rate limited; retry later";
  }
  return `Upstream request failed with status ${status}`;
}

export function formatTimeoutError(ms: number): string {
  return `Request timed out after ${ms}ms`;
}

export function safeErrorMessage(err: unknown): string {
  if (err instanceof McpToolError) {
    return err.message;
  }
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return err.message;
    }
    return err.message;
  }
  return "An unexpected error occurred";
}
