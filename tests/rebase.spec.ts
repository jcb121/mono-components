import { execSync } from "child_process";
import { rmSync, existsSync, readFileSync, writeFileSync } from "fs";
import { relative } from "path";
import { describe, afterEach, it, expect } from "vitest";
import { getPath, baseCommand } from "./utils.js";

describe("rebase command", () => {
  afterEach(() => {
    rmSync(getPath(), { recursive: true, force: true });
  });

  it("should only allow folders to be branched", () => {
    execSync(`cp -r ./test-in/button ${getPath()}/button`);

    try {
      execSync(
        `${baseCommand()} branch ${getPath()}/button/index.tsx ${getPath()}/button-1/index.ts`,
        { stdio: "pipe" }
      );
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.stderr.toString()).toContain("Source must be a directory");
    }
  })


  it("should rebase the changes", () => {
    // copy a mock to the test folder
    execSync(`cp -r ./test-in/button ${getPath()}/button`);

    // create a branch of the component
    execSync(
      `${baseCommand()} branch ${getPath()}/button ${getPath()}/button-1`,
    );
    expect(existsSync(`${getPath()}/button-1`)).toBe(true);

    // update the base component
    const contents = readFileSync(`${getPath()}/button/index.tsx`, "utf-8");
    writeFileSync(
      `${getPath()}/button/index.tsx`,
      contents.replace("Button", "MyButton"),
    );

    // rebase the component
    execSync(
      `${baseCommand()} rebase ${getPath()}/button ${getPath()}/button-1`,
    );
    expect(readFileSync(`${getPath()}/button-1/index.tsx`, "utf-8")).toContain(
      "export const MyButton = () => {",
    );
  });

  it("should attempt a rebase and leave git markers", () => {
    // copy a mock to the test folder
    execSync(`cp -r ./test-in/button ${getPath()}/button`);

    // create a branch of the component
    execSync(
      `${baseCommand()} branch ${getPath()}/button ${getPath()}/button-1`,
    );
    expect(existsSync(`${getPath()}/button-1`)).toBe(true);

    // update the base component
    const contents = readFileSync(`${getPath()}/button/index.tsx`, "utf-8");
    writeFileSync(
      `${getPath()}/button/index.tsx`,
      contents.replace("Button", "MyButton"),
    );

    // update the branched component
    const newContents = readFileSync(`${getPath()}/button-1/index.tsx`, "utf-8");
    writeFileSync(
      `${getPath()}/button-1/index.tsx`,
      newContents.replace("Button", "TheirButton"),
    );

    // rebase the component
    execSync(
      `${baseCommand()} rebase ${getPath()}/button ${getPath()}/button-1`,
    );

    const fileContents = readFileSync(`${getPath()}/button-1/index.tsx`, "utf-8");

    expect(fileContents).toContain("export const MyButton = () => {");
    expect(fileContents).toContain("export const TheirButton = () => {");

    expect(fileContents).toContain(`<<<<<<< ${getPath()}/button-1/index.tsx`);
    expect(fileContents).toContain("=======");
    expect(fileContents).toContain(`>>>>>>> ${getPath()}/button/index.tsx`);
  });

  it("should rebase all", () => {
    // copy a mock to the test folder for the base
    execSync(`cp -r ./test-in/button ${getPath()}/button`);

    // branch the new mock component
    execSync(
      `${baseCommand()} branch ${getPath()}/button ${getPath()}/button-1`,
    );
    execSync(
      `${baseCommand()} branch ${getPath()}/button ${getPath()}/button-2`,
    );

    // edit the base
    const contents = readFileSync(`${getPath()}/button/index.tsx`, "utf-8");
    writeFileSync(
      `${getPath()}/button/index.tsx`,
      contents.replace("Button", "MyButton"),
    );

    const contents1 = readFileSync(`${getPath()}/button-1/index.tsx`, "utf-8");
    writeFileSync(
      `${getPath()}/button-1/index.tsx`,
      contents1.replace("{}", "Button1"),
    );

    const contents2 = readFileSync(`${getPath()}/button-2/index.tsx`, "utf-8");
    writeFileSync(
      `${getPath()}/button-2/index.tsx`,
      contents2.replace("{}", "Button2"),
    );

    execSync(`${baseCommand()} rebase ${getPath()}/button --all`);


    const newContents1 = readFileSync(`${getPath()}/button-1/index.tsx`, "utf-8");
    expect(newContents1).toContain("export const MyButton = () => {");
    expect(newContents1).toContain("<button>Button1</button>");

    const newContents2 = readFileSync(`${getPath()}/button-2/index.tsx`, "utf-8");
    expect(newContents2).toContain("export const MyButton = () => {");
    expect(newContents2).toContain("<button>Button2</button>");
  });
});