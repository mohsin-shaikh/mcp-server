const baseUrl = process.env["CHAT_API_URL"] ?? "http://127.0.0.1:3200";
const totalRequests = Number.parseInt(process.env["LOAD_TEST_REQUESTS"] ?? "", 10) || 100;
const concurrency = Number.parseInt(process.env["LOAD_TEST_CONCURRENCY"] ?? "", 10) || 10;

type TimedResult = {
  ok: boolean;
  durationMs: number;
};

async function timedRequest(path: string, init?: RequestInit): Promise<TimedResult> {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, init);
    return { ok: response.ok, durationMs: Date.now() - startedAt };
  } catch {
    return { ok: false, durationMs: Date.now() - startedAt };
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

async function runBatch(
  count: number,
  worker: () => Promise<TimedResult>,
): Promise<TimedResult[]> {
  const results: TimedResult[] = [];
  let next = 0;

  async function workerLoop(): Promise<void> {
    while (true) {
      const current = next;
      next += 1;
      if (current >= count) {
        return;
      }
      results.push(await worker());
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => workerLoop()));
  return results;
}

function summarize(label: string, results: TimedResult[]): void {
  const durations = results.map((result) => result.durationMs);
  const failures = results.filter((result) => !result.ok).length;

  console.log(`\n${label}`);
  console.log(`  requests: ${results.length}`);
  console.log(`  failures: ${failures}`);
  console.log(`  p50: ${percentile(durations, 50)}ms`);
  console.log(`  p95: ${percentile(durations, 95)}ms`);
  console.log(`  p99: ${percentile(durations, 99)}ms`);
}

async function main(): Promise<void> {
  console.log(`Load testing ${baseUrl}`);
  console.log(`requests=${totalRequests} concurrency=${concurrency}`);

  const healthResults = await runBatch(totalRequests, () => timedRequest("/health"));
  summarize("GET /health", healthResults);

  const sessionResults = await runBatch(totalRequests, () =>
    timedRequest("/chat/sessions", { method: "POST" }),
  );
  summarize("POST /chat/sessions", sessionResults);

  const p95 = percentile(
    sessionResults.map((result) => result.durationMs),
    95,
  );
  if (p95 > 10_000) {
    console.error(`\nFAIL: session create p95 ${p95}ms exceeds 10s target`);
    process.exitCode = 1;
  } else {
    console.log(`\nPASS: session create p95 ${p95}ms is within 10s target`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
