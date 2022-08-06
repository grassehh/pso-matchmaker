/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testPathIgnorePatterns: [
    "node_modules",
    "build"
  ],
  testEnvironment: './bot/test/test-environment.ts',
};