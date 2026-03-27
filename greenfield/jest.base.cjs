/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
  moduleNameMapper: {
    '^@megaconvert/([a-z-]+)$': '<rootDir>/../../packages/$1/src/index.ts'
  },
  rootDir: '.',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        diagnostics: {
          warnOnly: false
        }
      }
    ]
  }
};
