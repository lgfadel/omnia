import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".next", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "off",
      "no-restricted-imports": [
        "error",
        {
          "patterns": [
            {
              "group": ["@/contexts/*"],
              "message": "Imports from @/contexts are deprecated. Use Zustand stores instead."
            },
            {
              "group": ["@/data/fixtures"],
              "message": "Imports from @/data/fixtures are deprecated. Use proper data repositories instead."
            }
          ]
        }
      ],
    },
  }
);
