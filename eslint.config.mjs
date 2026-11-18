import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

/**
 * 质量闸门只覆盖源码与脚本：
 * 构建产物、数据、图片、文档与缓存目录一律不参与 lint，避免无意义的噪音。
 */
const IGNORED = [
  'dist/**',
  'node_modules/**',
  'public/**',
  'data/**',
  'images/**',
  'docs/**',
  '.cache/**',
  '.screenshots/**',
  '.trae-html-share-packages/**',
  'coverage/**',
]

export default tseslint.config(
  { ignores: IGNORED },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'],
  })),
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // 类型检查已由 tsc（noUnusedLocals/noUnusedParameters）负责，ESLint 只做补充
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // 测试同时运行在 Node 环境，补齐 Buffer / process 等全局
    files: ['tests/**/*.{ts,mjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
)
