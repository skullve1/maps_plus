import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const config = tseslint.config(
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "public/maplibre-gl-worker.mjs"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "error"
    }
  }
);

export default config;
