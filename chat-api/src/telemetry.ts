import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

export async function initTelemetry(serviceName: string): Promise<() => Promise<void>> {
  if (process.env["OTEL_ENABLED"] !== "true") {
    return async () => undefined;
  }

  const endpoint =
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] ?? "http://localhost:4318/v1/traces";

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
  });

  await sdk.start();

  return async () => {
    await sdk.shutdown();
  };
}
