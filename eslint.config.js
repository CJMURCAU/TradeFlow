// ESLint flat config (audit: linting). Uses Expo's shared config.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'supabase/functions/**', // Deno runtime, linted/typed separately
      'db-test/**',
    ],
  },
  {
    // Lint is being introduced onto an existing bolt.new codebase. These
    // (mostly React-Compiler) rules flag long-standing patterns; surface them
    // as warnings so they're visible without blocking CI, and tighten over time.
    rules: {
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
];
