import { describe, expect, it } from "vitest";
import { loadConfigFromEnv, mergeConfig } from "../src/config.js";
import { validateApiKeyHeader, validateTransportAuth } from "../src/middleware/auth.js";

describe("transport auth", () => {
  it("requires MCP_API_KEY for api_key mode on http transport", () => {
    const config = mergeConfig(loadConfigFromEnv(), {
      transport: "http",
      authMode: "api_key",
      apiKey: undefined,
    });
    expect(() => validateTransportAuth(config)).toThrow("MCP_API_KEY");
  });

  it("validates x-api-key header", () => {
    const config = mergeConfig(loadConfigFromEnv(), {
      transport: "http",
      authMode: "api_key",
      apiKey: "secret-key",
    });
    expect(validateApiKeyHeader(config, { "x-api-key": "secret-key" })).toBe(true);
    expect(validateApiKeyHeader(config, { "x-api-key": "wrong" })).toBe(false);
  });

  it("validates bearer token", () => {
    const config = mergeConfig(loadConfigFromEnv(), {
      transport: "http",
      authMode: "bearer",
      apiKey: "secret-token",
    });
    expect(
      validateApiKeyHeader(config, {
        authorization: "Bearer secret-token",
      }),
    ).toBe(true);
    expect(
      validateApiKeyHeader(config, {
        authorization: "Bearer wrong",
      }),
    ).toBe(false);
  });

  it("allows all requests when auth mode is none", () => {
    const config = mergeConfig(loadConfigFromEnv(), {
      transport: "http",
      authMode: "none",
    });
    expect(validateApiKeyHeader(config, {})).toBe(true);
  });
});
