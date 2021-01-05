const { pathsToModuleNameMapper } = require('ts-jest/utils')
const { compilerOptions } = require('./tsconfig')

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  preset: 'ts-jest',
  testRegex: '[^-]spec.ts$',
  testEnvironment: 'node',
  coverageDirectory: './coverage',
  verbose: true,
  roots: ['<rootDir>/src'],
  collectCoverageFrom: ['**/*.{js,jsx}', '**/*.{ts,tx}', '!**/node_modules/**'],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths, {
      prefix: '<rootDir>/',
    }),
    'src/authorize/(.*)': '<rootDir>/src/authorize/$1',
    'src/flush/(.*)': '<rootDir>/src/authorize/$1',
  },
}
