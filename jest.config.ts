import type { Config } from "@jest/types"

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testPathIgnorePatterns: [
    "node_modules",
    "build"
  ],
  verbose: true
};
export default config;