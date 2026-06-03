const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: { ecmaVersion: 2020, sourceType: 'module', project: './tsconfig.json' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: Object.assign({}, (tsPlugin.configs && tsPlugin.configs.recommended && tsPlugin.configs.recommended.rules) || {}, {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn'
    }),
  },
];
