import type { MetricsRecorder } from "../lib/metrics.js";

export const noopMetrics: MetricsRecorder = {
  recordToolCall() {
    return;
  },
  recordModuleRegistration() {
    return;
  },
  async shutdown() {
    return;
  },
};
