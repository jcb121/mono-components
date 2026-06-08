import { execSync } from "child_process";
import { resolve } from "path";
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "fs";
import { afterEach, describe, it, expect } from "vitest";
import { baseCommand, getPath } from "./utils.js";


describe("branch command", () => {
  afterEach(() => {
    rmSync(getPath(), { recursive: true, force: true });
  });

  it("should create a simple copy", () => {
    // copy a mock to the test folder
    execSync(`cp -r ./test-in/button ${getPath()}/button`);

    // branch the new mock component
    execSync(
      `${baseCommand()}  branch ${getPath()}/button ${getPath()}/button-1`,
    );

    expect(existsSync(`${getPath()}/button-1`)).toBe(true);

    const contents = readFileSync(`${getPath()}/button-1/index.tsx`, "utf-8");
    expect(contents).toContain(`// branched from: ${getPath()}/button`);
    expect(contents).toContain(
      readFileSync("./test-in/button/index.tsx", "utf-8"),
    );
  });
});
