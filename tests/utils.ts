import { mkdirSync } from "fs";
import { join } from "path";
import { expect } from "vitest";

export const getPath = () => {
  const path = join(
    "./test-out",
    expect.getState().currentTestName?.replace(/[^a-z0-9]/gi, "-") ?? "",
  );

  mkdirSync(path, { recursive: true });

  return path;
};

export const baseCommand = () => {
  return `npx tsx ./src/index.ts --bases-dir ${getPath()}/bases`
}
