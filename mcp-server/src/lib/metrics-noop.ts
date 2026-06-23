import type { MetricsRecorder } from "./metrics.js";

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
