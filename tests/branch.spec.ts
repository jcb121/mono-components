import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, rmSync } from "fs";
import { afterEach, describe, it, expect } from "vitest";

describe("branch command", () => {
  const NAME = "myTestButtonBranched";

  afterEach(() => {
    rmSync(`./test-out/button`, { recursive: true, force: true });
    rmSync(`./test-out/${NAME}`, { recursive: true, force: true });
    rmSync(`./.variant-bases/${NAME}`, { recursive: true, force: true });
  });

  it("should create a simple copy", () => {
    // copy a mock to the test folder
    execSync("cp -r ./test-in/button ./test-out/button");

    // branch the new mock component
    execSync(
      `npx tsx ./src/index.ts branch ./test-out/button ./test-out/${NAME}`,
    );

    expect(existsSync(`./test-out/${NAME}`)).toBe(true);

    const contents = readFileSync(`./test-out/${NAME}/index.tsx`, "utf-8");
    expect(contents).toContain("// branched from: ./test-out/button");
    expect(contents).toContain(
      readFileSync("./test-in/button/index.tsx", "utf-8"),
    );
  });
});

describe("rebase command", () => {
  const NAME = "myTestButtonRebased";
  const BASE = "button-1";

  afterEach(() => {
    rmSync(`./test-out/${BASE}`, { recursive: true, force: true });
    rmSync(`./test-out/${NAME}`, { recursive: true, force: true });
    rmSync(`./.variant-bases/${NAME}`, { recursive: true, force: true });
  });

  it("should rebase the changes", () => {
    // copy a mock to the test folder
    execSync(`cp -r ./test-in/button ./test-out/${BASE}`);

    // create a branch of the component
    execSync(
      `npx tsx ./src/index.ts branch ./test-out/${BASE} ./test-out/${NAME}`,
    );
    expect(existsSync(`./test-out/${NAME}`)).toBe(true);

    // update the base component
    const contents = readFileSync(`./test-out/${BASE}/index.tsx`, "utf-8");
    writeFileSync(
      `./test-out/${BASE}/index.tsx`,
      contents.replace("Button", "MyButton"),
    );

    // rebase the component
    execSync(
      `npx tsx ./src/index.ts rebase ./test-out/${BASE} ./test-out/${NAME}`,
    );
    expect(readFileSync(`./test-out/${NAME}/index.tsx`, "utf-8")).toContain(
      "export const MyButton = () => {",
    );
  });
});

describe("rebase command", () => {
  const NAME = "myTestButtonRebased2";
  const BASE = "button-2";

  afterEach(() => {
    rmSync(`./test-out/${BASE}`, { recursive: true, force: true });
    rmSync(`./test-out/${NAME}`, { recursive: true, force: true });
    rmSync(`./.variant-bases/${NAME}`, { recursive: true, force: true });
  });

  it("should rebase the changes", () => {
    // copy a mock to the test folder
    execSync(`cp -r ./test-in/button ./test-out/${BASE}`);

    // create a branch of the component
    execSync(
      `npx tsx ./src/index.ts branch ./test-out/${BASE} ./test-out/${NAME}`,
    );
    expect(existsSync(`./test-out/${NAME}`)).toBe(true);

    // update the base component
    const contents = readFileSync(`./test-out/${BASE}/index.tsx`, "utf-8");
    writeFileSync(
      `./test-out/${BASE}/index.tsx`,
      contents.replace("Button", "MyButton"),
    );

    // update the branched component
    const newContents = readFileSync(`./test-out/${NAME}/index.tsx`, "utf-8");
    writeFileSync(
      `./test-out/${NAME}/index.tsx`,
      newContents.replace("Button", "TheirButton"),
    );

    // rebase the component
    execSync(
      `npx tsx ./src/index.ts rebase ./test-out/${BASE} ./test-out/${NAME}`,
    );

    const fileContents = readFileSync(`./test-out/${NAME}/index.tsx`, "utf-8");

    expect(fileContents).toContain("export const MyButton = () => {");
    expect(fileContents).toContain("export const TheirButton = () => {");

    expect(fileContents).toContain(
      "<<<<<<< test-out/myTestButtonRebased2/index.tsx",
    );
    expect(fileContents).toContain("=======");
    expect(fileContents).toContain(">>>>>>> test-out/button-2/index.tsx");
  });
});

describe("list command", () => {
  const BASE = "list-button";
  const NAME = "list-button";

  afterEach(() => {
    rmSync(`./test-out/${NAME}`, { recursive: true, force: true });
    rmSync(`./test-out/${NAME}-1`, { recursive: true, force: true });
    rmSync(`./test-out/${NAME}-2`, { recursive: true, force: true });

    rmSync(`./.variant-bases/${NAME}`, { recursive: true, force: true });
    rmSync(`./.variant-bases/${NAME}-1`, { recursive: true, force: true });
    rmSync(`./.variant-bases/${NAME}-2`, { recursive: true, force: true });
  });

  it("should list variants branched from this component.", () => {
    // copy a button into the context
    execSync(`cp -r ./test-in/button ./test-out/${BASE}`);

    // create three copies
    execSync(
      `npx tsx ./src/index.ts branch ./test-out/${BASE} ./test-out/${NAME}-1`,
    );

    execSync(
      `npx tsx ./src/index.ts branch ./test-out/${BASE} ./test-out/${NAME}-2`,
    );

    const output = execSync(`npx tsx ./src/index.ts list ./test-out/${BASE}`, {
      encoding: "utf-8",
    });
    expect(output).toContain(`test-out/${NAME}-1`);
    expect(output).toContain(`test-out/${NAME}-2`);
  });
});
