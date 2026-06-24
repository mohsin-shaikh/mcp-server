import { describe, expect, it } from "vitest";
import { safeErrorMessage } from "../src/lib/errors.js";

describe("safeErrorMessage", () => {
  it("returns string errors as-is", () => {
    expect(safeErrorMessage("Host not in HTTP_TOOL_ALLOWED_HOSTS allowlist.")).toBe(
      "Host not in HTTP_TOOL_ALLOWED_HOSTS allowlist.",
    );
  });

  it("returns Error message", () => {
    expect(safeErrorMessage(new Error("network failed"))).toBe("network failed");
  });

  it("falls back for unknown values", () => {
    expect(safeErrorMessage({ code: 1 })).toBe("An unexpected error occurred");
  });
});
