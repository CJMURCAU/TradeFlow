/**
 * Unit tests for pure logic (audit: testing). Uses ts-jest in a node
 * environment — these tests cover framework-independent modules (e.g. the job
 * cost calculator), so we deliberately avoid the heavier jest-expo/RN preset.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
