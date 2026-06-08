import { execSync } from "child_process";
import { rmSync } from "fs";
import { describe, afterEach, it, expect } from "vitest";
import { getPath, baseCommand } from "./utils.js";

describe("list command", () => {
  afterEach(() => {
    rmSync(getPath(), { recursive: true, force: true });

  });

  it("should list variants branched from this component.", () => {
    // copy a button into the context
    execSync(`cp -r ./test-in/button ${getPath()}/button`);

    // create three copies
    execSync(
      `${baseCommand()} branch ${getPath()}/button ${getPath()}/button-1`,
    );

    execSync(
      `${baseCommand()} branch ${getPath()}/button ${getPath()}/button-2`,
    );

    const output = execSync(`${baseCommand()} list ${getPath()}/button`, {
      encoding: "utf-8",
    });
    expect(output).toContain(`${getPath()}/button-1`);
    expect(output).toContain(`${getPath()}/button-2`);
  });
});