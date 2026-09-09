// Flat config. Next 16 removed `next lint`, and eslint-config-next 16 ships
// flat-config exports directly — so this replaces the old .eslintrc.json and
// is run with the ESLint CLI (`eslint .`) instead.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  {
    /**
     * `.open-next/**` matters as much as `.next/**`: the OpenNext build emits a
     * single multi-megabyte bundled `worker.js`, and letting ESLint parse it
     * exhausts V8's heap and takes the whole run down with a stack trace rather
     * than a lint error.
     */
    ignores: [
      'backend/**',
      // Own app, own config, own lint run — see tsconfig.json's exclude.
      'admin/**',
      '.next/**',
      '.open-next/**',
      '.wrangler/**',
      'node_modules/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];

export default config;
