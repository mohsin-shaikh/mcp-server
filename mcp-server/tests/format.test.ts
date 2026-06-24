import { describe, expect, it } from "vitest";
import { parseCommaList, redact, truncate } from "../src/lib/format.js";
import { createHostAllowlistChecker } from "../src/context.js";

describe("format", () => {
  it("truncates large payloads", () => {
    const text = "a".repeat(100);
    const result = truncate(text, 50);
    expect(result).toContain("[truncated, 50 bytes omitted]");
  });

  it("redacts bearer tokens", () => {
    const text = "Authorization: Bearer secret-token-123";
    expect(redact(text)).toContain("[REDACTED]");
    expect(redact(text)).not.toContain("secret-token-123");
  });

  it("parses comma-separated lists", () => {
    expect(parseCommaList("a,b, c")).toEqual(["a", "b", "c"]);
    expect(parseCommaList("")).toEqual([]);
  });
});

describe("host allowlist", () => {
  it("denies all when allowlist is empty", () => {
    const check = createHostAllowlistChecker([]);
    expect(check("https://example.com/path")).toBe(false);
  });

  it("allows matching hosts", () => {
    const check = createHostAllowlistChecker(["api.github.com", "*.example.com"]);
    expect(check("https://api.github.com/repos")).toBe(true);
    expect(check("https://sub.example.com/x")).toBe(true);
    expect(check("https://evil.com/x")).toBe(false);
  });
});
