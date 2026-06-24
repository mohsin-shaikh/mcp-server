export type CircuitState = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private failures = 0;
  private state: CircuitState = "closed";
  private openedAt = 0;

  constructor(
    private readonly failureThreshold = 3,
    private readonly cooldownMs = 30_000,
  ) {}

  getState(): CircuitState {
    return this.state;
  }

  canAttempt(): boolean {
    if (this.state === "closed") {
      return true;
    }

    if (this.state === "open" && Date.now() - this.openedAt >= this.cooldownMs) {
      this.state = "half-open";
      return true;
    }

    return this.state === "half-open";
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }
}
