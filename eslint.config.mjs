import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Project-specific ignores (generated artifacts and tooling)
    "scripts/**",
    "*.sql",
    "check-*.ts",
    "count-*.ts",
    "migrate-*.ts",
    "create-*.ts",
    "temp-*.ts",
  ]),
  {
    files: ["scripts/**/*.{ts,js}", "check-*.ts", "count-*.ts", "migrate-*.ts", "create-*.ts", "temp-*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      "jsx-a11y/alt-text": "off",
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
