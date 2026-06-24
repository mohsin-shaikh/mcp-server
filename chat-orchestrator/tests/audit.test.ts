import { describe, expect, it } from "vitest";
import { hashToolArgs } from "../src/audit.js";

describe("hashToolArgs", () => {
  it("returns a stable short hash", () => {
    const hash = hashToolArgs({ id: "ord_123" });
    expect(hash).toHaveLength(16);
    expect(hashToolArgs({ id: "ord_123" })).toBe(hash);
  });

  it("changes when args change", () => {
    const first = hashToolArgs({ id: "ord_123" });
    const second = hashToolArgs({ id: "ord_456" });
    expect(first).not.toBe(second);
  });
});
