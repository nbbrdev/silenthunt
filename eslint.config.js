import js from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import { importX } from "eslint-plugin-import-x";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist/**", "coverage/**", "assets-private/**"]),

  js.configs.recommended,
  tseslint.configs.recommended,

  // Regras do projeto (NBB-124 I3-A, as mesmas do Codetomb).
  {
    plugins: { "import-x": importX },
    rules: {
      // Tipagem estrita: sem `any` (use `unknown`) e sem `!` para silenciar nulos.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // Com `verbatimModuleSyntax`, `import { type X } from "y"` ainda carrega o módulo "y" inteiro
      // (no Babylon, isso deixou um teste 100x mais lento). Exige `import type { X }` nesses casos.
      "@typescript-eslint/no-import-type-side-effects": "error",

      // Só importar pacotes declarados no package.json (NBB-124 V2-A: plugin import-x).
      "import-x/no-extraneous-dependencies": "error",
    },
  },

  // Desliga regras de formatação que conflitam com o Prettier (deve ser o último bloco de regras).
  prettier,
]);
