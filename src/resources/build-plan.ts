import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function projectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const dir = path.dirname(currentFile);
  // src/resources or dist/ chunk — project root is two levels up from src/resources
  return path.resolve(dir, "../..");
}

export async function readBuildPlan(): Promise<string> {
  const candidates = [
    path.join(projectRoot(), "docs/build-plan.md"),
    path.join(process.cwd(), "docs/build-plan.md"),
  ];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8");
    } catch {
      continue;
    }
  }

  return "# Build plan\n\nBuild plan file not found on disk.";
}
