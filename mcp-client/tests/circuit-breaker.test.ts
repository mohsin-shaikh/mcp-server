import { describe, expect, it } from "vitest";
import { CircuitBreaker } from "../src/circuit-breaker.js";

describe("CircuitBreaker", () => {
  it("opens after repeated failures", () => {
    const breaker = new CircuitBreaker(2, 1_000);
    expect(breaker.canAttempt()).toBe(true);

    breaker.recordFailure();
    expect(breaker.canAttempt()).toBe(true);

    breaker.recordFailure();
    expect(breaker.getState()).toBe("open");
    expect(breaker.canAttempt()).toBe(false);
  });

  it("closes again after a success", () => {
    const breaker = new CircuitBreaker(2, 1_000);
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe("open");

    breaker.recordSuccess();
    expect(breaker.getState()).toBe("closed");
    expect(breaker.canAttempt()).toBe(true);
  });

  it("moves to half-open after cooldown", async () => {
    const breaker = new CircuitBreaker(1, 20);
    breaker.recordFailure();
    expect(breaker.canAttempt()).toBe(false);

    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });

    expect(breaker.canAttempt()).toBe(true);
    expect(breaker.getState()).toBe("half-open");
  });
});
