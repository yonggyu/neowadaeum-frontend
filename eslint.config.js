import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // `_contract` 는 CI 가 받아 두는 백엔드 레포다 (.github/workflows/ci.yml). 남의 소스이고
  // 우리 규칙으로 판단할 대상이 아니다 — 넣어 두지 않으면 `eslint .` 이 그것까지 린트한다.
  { ignores: ['dist', 'src/api/schema.d.ts', '_contract', '.claude'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
)
