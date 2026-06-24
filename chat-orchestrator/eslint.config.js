import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-console": "error",
    },
  },
  {
    files: ["src/cli.ts", "tests/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
);
