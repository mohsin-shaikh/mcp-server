import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli-args.js";

describe("parseCliArgs", () => {
  it("strips pnpm/tsx separator and --verbose", () => {
    const result = parseCliArgs([
      "node",
      "cli.ts",
      "--",
      "--verbose",
      "What",
      "is",
      "order",
      "ord_123?",
    ]);
    expect(result.verbose).toBe(true);
    expect(result.message).toBe("What is order ord_123?");
  });

  it("accepts a message without separator", () => {
    const result = parseCliArgs(["node", "cli.ts", "Hello there"]);
    expect(result.message).toBe("Hello there");
    expect(result.verbose).toBe(false);
  });
});
