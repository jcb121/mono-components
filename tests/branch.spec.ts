import { execSync } from "child_process";
import { resolve } from "path";
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "fs";
import { afterEach, describe, it, expect } from "vitest";

const getPath = () => {
  const path = resolve(
    "./test-out",
    expect.getState().currentTestName?.replace(/[^a-z0-9]/gi, "-") ?? "",
  );

  mkdirSync(path, { recursive: true });

  return path;
};

const baseCommand = () => {
  return `npx tsx ./src/index.ts --bases-dir ${getPath()}/bases`
}

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

describe("rebase command", () => {
  afterEach(() => {
    rmSync(getPath(), { recursive: true, force: true });
  });

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
});

describe("rebase command", () => {
  afterEach(() => {
    rmSync(getPath(), { recursive: true, force: true });
  });

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

    expect(fileContents).toContain(
      "<<<<<<< /Users/jesse/Projects/mono-components/test-out/rebase-command---should-rebase-the-changes/button-1/index.tsx"
    );
    expect(fileContents).toContain("=======");
    expect(fileContents).toContain(
      ">>>>>>> /Users/jesse/Projects/mono-components/test-out/rebase-command---should-rebase-the-changes/button/index.tsx"
    );
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
