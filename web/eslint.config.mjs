import { fileURLToPath } from 'node:url';
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

const RESOLVER_PATH = fileURLToPath(new URL('./eslint-ts-resolver.cjs', import.meta.url));
const WEB_ROOT = fileURLToPath(new URL('.', import.meta.url));

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dist-glb/**',
      'dist-irn/**',
      '.astro/**',
      'node_modules/**',
      '**/*.astro',
      'eslint.config.mjs',
      'eslint-ts-resolver.cjs',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    plugins: {
      boundaries,
    },
    settings: {
      'boundaries/root-path': WEB_ROOT,
      'import/resolver': {
        [RESOLVER_PATH]: {},
      },
      'boundaries/elements': [
        {
          type: 'features',
          pattern: 'src/spa/features/*',
          capture: ['feature'],
        },
        { type: 'spa_routes', pattern: ['src/spa/routes/*', 'src/spa/routes'] },
        { type: 'spa_stores', pattern: 'src/spa/stores' },
        { type: 'gateways', pattern: 'src/gateways' },
        { type: 'adapters', pattern: ['src/adapters/*', 'src/adapters'] },
        { type: 'composition', pattern: 'src/composition' },
        { type: 'components', pattern: ['src/components/*', 'src/components'] },
        { type: 'edition', pattern: ['src/edition/*', 'src/edition'] },
        { type: 'i18n', pattern: 'src/i18n' },
        { type: 'theme', pattern: 'src/theme' },
        { type: 'pages', pattern: ['src/pages/**', 'src/layouts/**', 'src/content/**', 'src/seo/**'] },
        { type: 'tests', pattern: 'tests/**' },
      ],
      'boundaries/files': [
        { pattern: 'src/spa/deps.tsx', category: 'di_context' },
        { pattern: 'src/spa/!(deps).{ts,tsx}', category: 'spa_shell' },
        { pattern: 'src/*.ts', category: 'spa_shell' },
      ],
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkAllOrigins: true,
          policies: [
            // Gateways: pure interfaces; only sibling gateways + @mockza/domain + @mockza/contracts.
            {
              from: { element: { type: 'gateways' } },
              allow: [
                { to: { element: { type: 'gateways' } } },
                {
                  to: {
                    module: {
                      origin: 'external',
                      source: ['@mockza/domain', '@mockza/contracts'],
                    },
                  },
                },
              ],
            },
            // Adapters: implement gateways; may use edition/i18n/other adapters and npm packages.
            {
              from: { element: { type: 'adapters' } },
              allow: [
                { to: { element: { types: ['adapters', 'gateways', 'edition'] } } },
                { to: { module: { origin: 'external' } } },
              ],
            },
            // DI Context (useDeps / AppDependenciesProvider): depends only on React, gateways, and edition.
            {
              from: { file: { categories: 'di_context' } },
              allow: [
                { to: { element: { types: ['gateways', 'edition'] } } },
                { to: { module: { origin: 'external', source: ['react', 'react/*'] } } },
              ],
            },
            // Composition roots: wire adapters -> gateways per edition.
            {
              from: { element: { type: 'composition' } },
              allow: [
                { to: { file: { categories: 'di_context' } } },
                {
                  to: {
                    element: { types: ['composition', 'gateways', 'adapters', 'edition'] },
                  },
                },
                { to: { module: { origin: 'external' } } },
              ],
            },
            // Components & Features: strictly depend on gateways, di_context, components, edition, i18n, theme — NEVER adapters, composition, dexie, @mockza/db, @mockza/ai, or sibling features.
            {
              from: { element: { type: 'components' } },
              allow: [
                { to: { file: { categories: 'di_context' } } },
                {
                  to: {
                    element: {
                      types: ['components', 'gateways', 'edition', 'i18n', 'theme'],
                    },
                  },
                },
                {
                  to: {
                    module: {
                      origin: 'external',
                      source: [
                        'react',
                        'react/*',
                        'react-dom',
                        'react-dom/*',
                        'lucide-react',
                        'dompurify',
                        '@radix-ui/*',
                        'react-resizable-panels',
                        '@mockza/domain',
                        '@mockza/contracts',
                        '@mockza/design-tokens',
                      ],
                    },
                  },
                },
              ],
            },
            {
              from: { element: { type: 'features' } },
              allow: [
                {
                  to: {
                    element: {
                      type: 'features',
                      captured: { feature: '{{ from.element.captured.feature }}' },
                    },
                  },
                },
                {
                  to: {
                    element: {
                      types: [
                        'gateways',
                        'components',
                        'edition',
                        'i18n',
                        'theme',
                        'spa_stores',
                      ],
                    },
                  },
                },
                {
                  to: {
                    file: { categories: ['spa_shell', 'di_context'] },
                  },
                },
                {
                  to: {
                    module: {
                      origin: 'external',
                      source: [
                        'react',
                        'react/*',
                        'react-dom',
                        'react-dom/*',
                        '@tanstack/*',
                        'zustand',
                        'lucide-react',
                        '@radix-ui/*',
                        '@mockza/domain',
                        '@mockza/contracts',
                        '@mockza/design-tokens',
                      ],
                    },
                  },
                },
              ],
            },
            // SPA routes: wire features/components/gateways/di_context; NEVER adapters, composition, dexie, @mockza/db, @mockza/ai.
            {
              from: { element: { type: 'spa_routes' } },
              allow: [
                {
                  to: {
                    element: {
                      types: [
                        'spa_routes',
                        'gateways',
                        'components',
                        'features',
                        'edition',
                        'i18n',
                        'theme',
                        'spa_stores',
                      ],
                    },
                  },
                },
                {
                  to: {
                    file: { categories: ['spa_shell', 'di_context'] },
                  },
                },
                {
                  to: {
                    module: {
                      origin: 'external',
                      source: [
                        'react',
                        'react/*',
                        'react-dom',
                        'react-dom/*',
                        '@tanstack/*',
                        'zustand',
                        'lucide-react',
                        '@radix-ui/*',
                        '@mockza/domain',
                        '@mockza/contracts',
                        '@mockza/design-tokens',
                      ],
                    },
                  },
                },
              ],
            },
            // Edition, i18n, theme
            {
              from: { element: { type: 'edition' } },
              allow: [
                { to: { element: { types: ['edition', 'theme'] } } },
                {
                  to: {
                    module: {
                      origin: 'external',
                      source: [
                        'react',
                        'react/*',
                        'jalaali-js',
                        '@mockza/domain',
                        '@mockza/contracts',
                        '@mockza/design-tokens',
                      ],
                    },
                  },
                },
              ],
            },
            {
              from: { element: { type: 'i18n' } },
              allow: [
                { to: { element: { types: ['i18n', 'edition'] } } },
                { to: { module: { origin: 'external', source: ['react', 'react/*'] } } },
              ],
            },
            {
              from: { element: { type: 'theme' } },
              allow: [
                { to: { element: { types: ['theme'] } } },
                {
                  to: {
                    module: {
                      origin: 'external',
                      source: ['@mockza/design-tokens'],
                    },
                  },
                },
              ],
            },
            // SPA root shell & stores (DesktopSimulatorApp, router, stores)
            {
              from: {
                element: { type: 'spa_stores' },
              },
              allow: [
                {
                  to: {
                    element: {
                      types: ['spa_stores', 'gateways', 'edition', 'i18n', 'theme'],
                    },
                  },
                },
                { to: { module: { origin: 'external' } } },
              ],
            },
            {
              from: {
                file: { categories: 'spa_shell' },
              },
              allow: [
                { to: { file: { categories: ['spa_shell', 'di_context'] } } },
                {
                  to: {
                    element: {
                      types: [
                        'spa_stores',
                        'spa_routes',
                        'composition',
                        'gateways',
                        'components',
                        'features',
                        'edition',
                        'i18n',
                        'theme',
                      ],
                    },
                  },
                },
                { to: { module: { origin: 'external' } } },
              ],
            },
            // Pages
            {
              from: { element: { type: 'pages' } },
              allow: [
                { to: { file: { categories: 'spa_shell' } } },
                {
                  to: {
                    element: {
                      types: ['pages', 'edition', 'i18n', 'theme', 'components', 'spa_stores'],
                    },
                  },
                },
                { to: { module: { origin: 'external' } } },
              ],
            },
            // Tests: allowed to test any layer
            {
              from: { element: { type: 'tests' } },
              allow: [
                { to: { file: { categories: ['spa_shell', 'di_context'] } } },
                {
                  to: {
                    element: {
                      types: [
                        'tests',
                        'gateways',
                        'adapters',
                        'composition',
                        'components',
                        'features',
                        'spa_routes',
                        'edition',
                        'i18n',
                        'theme',
                        'spa_stores',
                        'pages',
                      ],
                    },
                  },
                },
                { to: { module: { origin: ['external', 'core'] } } },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/spa/features/**/*.{ts,tsx}',
      'src/spa/routes/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/adapters',
                '@/adapters/*',
                '@/composition',
                '@/composition/*',
                '**/adapters',
                '**/adapters/**',
                '**/composition',
                '**/composition/**',
                'dexie/*',
                '@mockza/db/*',
                '@mockza/ai/*',
              ],
              message:
                'Features, routes, and components must depend on gateways and @/spa/deps only, never adapters, composition, dexie, @mockza/db, or @mockza/ai.',
            },
          ],
          paths: [
            {
              name: 'dexie',
              message: 'Features, routes, and components must never import dexie directly.',
            },
            {
              name: '@mockza/db',
              message: 'Features, routes, and components must never import @mockza/db.',
            },
            {
              name: '@mockza/ai',
              message: 'Features, routes, and components must never import @mockza/ai.',
            },
          ],
        },
      ],
    },
  },
);
