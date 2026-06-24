import { describe, expect, it } from "vitest";
import { getConfigJsonSchema } from "../src/resources/config-schema.js";
import { getModuleDoc, listModuleDocIds } from "../src/resources/module-docs.js";

describe("resources", () => {
  it("exports config JSON schema", () => {
    const schema = getConfigJsonSchema();
    expect(schema["title"]).toBe("McpServerConfig");
    expect(schema["properties"]).toHaveProperty("MCP_MODULES");
    expect(schema["properties"]).toHaveProperty("FS_ROOT");
  });

  it("lists module documentation", () => {
    const ids = listModuleDocIds();
    expect(ids).toContain("meta");
    expect(ids).toContain("docs");
    expect(ids).toContain("filesystem");
    expect(ids).toContain("openapi");
    expect(getModuleDoc("http")).toContain("http_fetch");
  });
});
