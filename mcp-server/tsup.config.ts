import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/registry/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node22",
  outDir: "dist",
});
