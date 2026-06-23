export interface MetricsRecorder {
  recordToolCall(tool: string, durationMs: number, success: boolean): void;
  recordModuleRegistration(moduleId: string): void;
  shutdown(): Promise<void>;
}

class NoopMetrics implements MetricsRecorder {
  recordToolCall(): void {
    return;
  }
  recordModuleRegistration(): void {
    return;
  }
  async shutdown(): Promise<void> {
    return;
  }
}

export async function createMetricsRecorder(options: {
  enabled: boolean;
  serviceName: string;
  endpoint?: string;
}): Promise<MetricsRecorder> {
  if (!options.enabled) {
    return new NoopMetrics();
  }

  try {
    const { metrics } = await import("@opentelemetry/api");
    const { MeterProvider, PeriodicExportingMetricReader } =
      await import("@opentelemetry/sdk-metrics");
    const { OTLPMetricExporter } = await import("@opentelemetry/exporter-metrics-otlp-http");
    const { Resource } = await import("@opentelemetry/resources");
    const { ATTR_SERVICE_NAME } = await import("@opentelemetry/semantic-conventions");

    const exporter = new OTLPMetricExporter({
      url: options.endpoint ?? "http://localhost:4318/v1/metrics",
    });

    const provider = new MeterProvider({
      resource: new Resource({
        [ATTR_SERVICE_NAME]: options.serviceName,
      }),
      readers: [
        new PeriodicExportingMetricReader({
          exporter,
          exportIntervalMillis: 15_000,
        }),
      ],
    });

    metrics.setGlobalMeterProvider(provider);
    const meter = provider.getMeter("mcp-server");
    const toolCalls = meter.createCounter("mcp.tool.calls", {
      description: "Total MCP tool invocations",
    });
    const toolErrors = meter.createCounter("mcp.tool.errors", {
      description: "Failed MCP tool invocations",
    });
    const toolDuration = meter.createHistogram("mcp.tool.duration_ms", {
      description: "MCP tool execution duration in milliseconds",
      unit: "ms",
    });
    const moduleRegistrations = meter.createCounter("mcp.module.registrations", {
      description: "Registered MCP modules",
    });

    return {
      recordToolCall(tool, durationMs, success) {
        const attrs = { tool };
        toolCalls.add(1, attrs);
        toolDuration.record(durationMs, attrs);
        if (!success) {
          toolErrors.add(1, attrs);
        }
      },
      recordModuleRegistration(moduleId) {
        moduleRegistrations.add(1, { module: moduleId });
      },
      async shutdown() {
        await provider.shutdown();
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to initialize OpenTelemetry metrics: ${message}`);
  }
}
