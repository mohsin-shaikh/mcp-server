import { describe, expect, it } from "vitest";
import { truncateToolResult } from "../src/truncate.js";

describe("truncateToolResult", () => {
  it("returns short content unchanged", () => {
    expect(truncateToolResult("hello")).toBe("hello");
  });

  it("truncates content that exceeds the byte limit", () => {
    const content = "a".repeat(100);
    const truncated = truncateToolResult(content, 50);
    expect(truncated.startsWith("a".repeat(50))).toBe(true);
    expect(truncated).toContain("[truncated 50 bytes");
  });
});
