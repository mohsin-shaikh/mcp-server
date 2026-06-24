import { SpanStatusCode, trace } from "@opentelemetry/api";

const TRACER_NAME = "zuupee-mcp-client";

export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer(TRACER_NAME);
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      if (err instanceof Error) {
        span.recordException(err);
      }
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    } finally {
      span.end();
    }
  });
}
