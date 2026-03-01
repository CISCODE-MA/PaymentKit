import type { Config } from 'jest';

const config: Config = {
    testEnvironment: 'node',
    clearMocks: true,
    testMatch: ['<rootDir>/test/**/*.spec.ts', '<rootDir>/test/**/*.test.ts', '<rootDir>/src/**/*.spec.ts'],
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    },
    moduleNameMapper: {
        '^@common/(.*)$': '<rootDir>/src/common/$1',
        '^@config/(.*)$': '<rootDir>/src/config/$1',
        '^@core/(.*)$': '<rootDir>/src/core/$1',
        '^@adapters/(.*)$': '<rootDir>/src/adapters/$1',
        '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    },
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/index.ts'],
    coverageDirectory: 'coverage',
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
        },
    },
};

export default config;
