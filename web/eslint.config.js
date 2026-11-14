import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      // Type-aware linting, needed by the promise rules below.
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Real bug classes in async Supabase code: a dropped promise hides a failed write,
      // and an async handler passed where a void callback is expected swallows its error.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      // Architecture rule (docs/architecture.md): another feature is reached only through
      // its index.ts, never through its internal folders. This measures and enforces coupling.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*'],
              message: "Import another feature through its public API: '@/features/<feature>' (index.ts), not its internals.",
            },
          ],
        },
      ],
      // Numbers for refactoring (bad smells): warnings only, so they guide without blocking.
      complexity: ['warn', 15],
      'max-lines-per-function': ['warn', { max: 150, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // A describe() block is long by nature; the size and complexity numbers are for product code.
    files: ['**/*.test.{ts,tsx}', 'e2e/**'],
    rules: { 'max-lines-per-function': 'off', complexity: 'off' },
  },
  {
    // Components must not call the Supabase client directly (docs/architecture.md, Data flow).
    // A warning, because AuthProvider predates the rule; new code should use a hook or adapter.
    files: ['src/features/*/components/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          paths: [
            {
              name: '@/shared/lib/supabase',
              message: 'UI components must not call the Supabase client; use a feature hook or API adapter.',
            },
          ],
          patterns: [{ group: ['@/features/*/*'], message: 'Import another feature through its index.ts.' }],
        },
      ],
    },
  },
);
