import { describe, expect, it } from "vitest";
import { buildOperationRequest, listOperations, parseOpenApiSpec } from "../src/lib/openapi.js";

const sampleSpec = {
  openapi: "3.0.3",
  servers: [{ url: "https://api.example.com/v1" }],
  paths: {
    "/users/{userId}": {
      get: {
        operationId: "getUser",
        summary: "Get user",
        parameters: [{ name: "userId", in: "path", required: true }],
      },
      post: {
        operationId: "createUser",
        requestBody: { content: { "application/json": {} } },
      },
    },
  },
};

describe("openapi parser", () => {
  it("lists operations from a spec", () => {
    const spec = parseOpenApiSpec(sampleSpec);
    const operations = listOperations(spec);
    expect(operations.map((op) => op.operationId)).toEqual(["createUser", "getUser"]);
  });

  it("builds a request for an operation", () => {
    const spec = parseOpenApiSpec(sampleSpec);
    const request = buildOperationRequest(spec, "getUser", {
      pathParams: { userId: "42" },
      query: { include: "profile" },
    });
    expect(request.url).toBe("https://api.example.com/v1/users/42?include=profile");
    expect(request.method).toBe("GET");
  });
});
