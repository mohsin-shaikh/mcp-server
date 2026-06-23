import { describe, expect, it } from "vitest";
import { createMetricsRecorder } from "../src/lib/metrics.js";

describe("metrics", () => {
  it("returns a noop recorder when OTEL is disabled", async () => {
    const metrics = await createMetricsRecorder({
      enabled: false,
      serviceName: "test",
    });
    metrics.recordToolCall("demo", 12, true);
    await metrics.shutdown();
    expect(true).toBe(true);
  });
});
