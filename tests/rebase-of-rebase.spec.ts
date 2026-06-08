import { execSync } from "child_process";
import { rmSync, existsSync, readFileSync, writeFileSync } from "fs";
import { describe, afterEach, it, expect } from "vitest";
import { getPath, baseCommand } from "./utils.js";

describe("rebase command", () => {
  afterEach(() => {
    rmSync(getPath(), { recursive: true, force: true });
  });

  it("should fail to rebase if there is a downstream variant", () => {
    // copy a mock to the test folder
    execSync(`cp -r ./test-in/button ${getPath()}/button`);

    // create a branch of the component
    execSync(
      `${baseCommand()} branch ${getPath()}/button ${getPath()}/button-1`,
    );
    // create a branch of that component
    execSync(
      `${baseCommand()} branch ${getPath()}/button-1 ${getPath()}/button-2`,
    );


    // update the base component
    const contents = readFileSync(`${getPath()}/button-1/index.tsx`, "utf-8");
    writeFileSync(
      `${getPath()}/button/index.tsx`,
      contents.replace("Button", "MyButton1"),
    );

    // rebase should fail because button-1 has a downstream variant (button-2)
    try {
      execSync(`${baseCommand()} rebase ${getPath()}/button ${getPath()}/button-1`, { stdio: "pipe" });
      expect.fail("should have thrown");
    } catch (err: any) {
      const stderr = err.stderr.toString();
      expect(stderr).toContain("downstream variants");
      expect(stderr).toContain(`${getPath()}/button-2`);
    }
  });
})