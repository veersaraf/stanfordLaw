/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests/unit", "<rootDir>/tests/integration"],
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          esModuleInterop: true,
          moduleResolution: "bundler",
          module: "commonjs",
          target: "ES2022",
          isolatedModules: true,
          baseUrl: ".",
          paths: {
            "@/*": ["./src/*"],
          },
        },
        diagnostics: false,
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  clearMocks: true,
  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "!src/lib/db.ts",
    "!src/lib/queue.ts",
    "!src/lib/**/*.d.ts",
  ],
  coverageDirectory: "coverage",
};
