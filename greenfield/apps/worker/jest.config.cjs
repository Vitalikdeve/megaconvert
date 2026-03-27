const base = require('../../jest.base.cjs');

module.exports = {
  ...base,
  rootDir: '.',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json'
      }
    ]
  }
};
