import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadPluginModule } from "../src/plugins/loader.js";
import { clearPluginModules, loadPluginsForConfig, resolveModules } from "../src/modules/index.js";

describe("plugin loader", () => {
  afterEach(() => {
    clearPluginModules();
  });

  it("loads the example plugin module", async () => {
    const pluginsDir = path.join(process.cwd(), "plugins");
    const mod = await loadPluginModule(pluginsDir, "example");
    expect(mod?.id).toBe("example");
    expect(mod?.name).toBe("Example");
  });

  it("resolves plugin modules alongside built-ins", async () => {
    const pluginsDir = path.join(process.cwd(), "plugins");
    await loadPluginsForConfig(pluginsDir, ["meta", "example"]);
    const modules = resolveModules(["meta", "example"]);
    expect(modules.map((mod) => mod.id)).toEqual(["meta", "example"]);
  });
});
