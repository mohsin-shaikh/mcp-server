import { describe, expect, it } from "vitest";
import { parseSseBuffer } from "../src/api.js";

describe("parseSseBuffer", () => {
  it("parses complete SSE events", () => {
    const input =
      [
        "event: text_delta",
        'data: {"delta":"Hello"}',
        "",
        "event: done",
        'data: {"message":"Hello"}',
        "",
      ].join("\n") + "\n";

    const { events, remainder } = parseSseBuffer(input);
    expect(remainder).toBe("");
    expect(events).toEqual([
      { event: "text_delta", data: '{"delta":"Hello"}' },
      { event: "done", data: '{"message":"Hello"}' },
    ]);
  });

  it("keeps partial events in the remainder", () => {
    const input = 'event: text_delta\ndata: {"delta":"Hel"';
    const { events, remainder } = parseSseBuffer(input);
    expect(events).toEqual([]);
    expect(remainder).toBe(input);
  });
});
