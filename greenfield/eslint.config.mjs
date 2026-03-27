import {
  createBaseConfig,
  createNextConfig,
  createNodeConfig,
} from './packages/eslint-config/src/index.mjs';

export default [
  ...createBaseConfig(),
  ...createNodeConfig({
    files: ['apps/api/**/*.ts', 'apps/realtime/**/*.ts', 'apps/worker/**/*.ts', 'packages/**/*.ts'],
  }),
  ...createNextConfig({
    files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx'],
  }),
];
