#!/usr/bin/env node
import { program } from "commander";
import fs, { existsSync, globSync } from "fs";
import path from "path";
import { execSync } from "child_process";

function findPackageRoot(): string {
  let dir = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      console.error("Could not find a package.json in any parent directory");
      process.exit(1);
    }
    dir = parent;
  }
}

function getBasesDir(): string {
  const opts = program.opts<{ basesDir?: string }>();
  const dir = opts.basesDir ? path.resolve(opts.basesDir) : path.join(findPackageRoot(), ".variant-bases");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function findVariants(sourcePath: string): string[] {
  const header = `// branched from: ${sourcePath}`;
  const root = findPackageRoot();
  return [...new Set(
    globSync("**/*", { cwd: root, exclude: (p) => p.includes("node_modules") })
      .filter((f) => {
        const abs = path.join(root, f);
        if (!fs.statSync(abs).isFile()) return false;
        const firstLine = fs.readFileSync(abs, "utf-8").split("\n")[0];
        return firstLine === header;
      })
      .map((f) => path.join(root, path.dirname(f)))
  )];
}

try {
  execSync("git --version", { stdio: "ignore" });
} catch {
  console.error("git is not installed or not in PATH");
  process.exit(1);
}

program
  .name("variant")
  .option("--bases-dir <path>", "directory to store base snapshots");

program
  .command("branch <sourcePath> <targetPath>")
  .description("scaffold a new component variant at the given path")
  .action((sourcePath: string, targetPath: string) => {
    if (!existsSync(sourcePath)) {
      console.error(`Source does not exist: ${sourcePath}`);
      process.exit(1);
    }
    if (existsSync(targetPath)) {
      console.error(`Target already exists: ${targetPath}`);
      process.exit(1);
    }

    const header = `// branched from: ${sourcePath}\n`;
    deepCopyFolder(sourcePath, targetPath, header);

    const baseName = path.basename(path.resolve(targetPath));
    const baseSnapshot = path.join(getBasesDir(), baseName);
    deepCopyFolder(sourcePath, baseSnapshot, header);

    console.log(`Branched ${sourcePath} → ${targetPath}`);
  });

program
  .command("rebase <sourcePath> [targetPath]")
  .description("apply upstream changes from source into the target variant")
  .option("--all", "rebase all variants branched from source")
  .action((sourcePath: string, targetPath: string | undefined, options: { all?: boolean }) => {
    const targets = options.all ? findVariants(sourcePath) : targetPath ? [targetPath] : [];

    if (targets.length === 0) {
      console.error("Specify a target path or use --all");
      process.exit(1);
    }

    for (const target of targets) {
      const baseName = path.basename(path.resolve(target));
      const baseSnapshot = path.join(getBasesDir(), baseName);

      if (!existsSync(baseSnapshot)) {
        console.error(`No base snapshot found for ${target}. Was it created with 'branch'?`);
        process.exit(1);
      }

      rebaseFolder(sourcePath, target, baseSnapshot);
      deepCopyFolder(sourcePath, baseSnapshot);
      console.log(`Rebased ${target} onto ${sourcePath}`);
    }
  });

program
  .command("list <sourcePath>")
  .description("list all variants branched from the given path")
  .action((sourcePath: string) => {
    const variants = findVariants(sourcePath);

    if (variants.length === 0) {
      console.log(`No variants found for ${sourcePath}`);
    } else {
      console.log(`Variants branched from ${sourcePath}:`);
      for (const v of variants) console.log(`  ${v}`);
    }
  });

program.parse();


function deepCopyFolder(src: string, dest: string, header?: string) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      deepCopyFolder(srcPath, destPath, header);
    } else if (header) {
      const contents = fs.readFileSync(srcPath, "utf-8");
      fs.writeFileSync(destPath, header + contents);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function rebaseFolder(source: string, target: string, base: string) {
  const entries = new Set([
    ...fs.readdirSync(source),
    ...fs.readdirSync(target),
  ]);

  for (const name of entries) {
    const sourcePath = path.join(source, name);
    const targetFile = path.join(target, name);
    const baseFile = path.join(base, name);

    const sourceIsDir = existsSync(sourcePath) && fs.statSync(sourcePath).isDirectory();
    const targetIsDir = existsSync(targetFile) && fs.statSync(targetFile).isDirectory();

    if (sourceIsDir || targetIsDir) {
      rebaseFolder(sourcePath, targetFile, baseFile);
      continue;
    }

    if (!existsSync(baseFile)) {
      fs.copyFileSync(sourcePath, targetFile);
      continue;
    }

    if (!existsSync(sourcePath)) {
      fs.rmSync(targetFile, { force: true });
      continue;
    }

    // 3-way merge: target = ours, base = ancestor, source = theirs
    // exit 1 = conflicts present but merge written with markers — not a fatal error
    try {
      execSync(`git merge-file "${targetFile}" "${baseFile}" "${sourcePath}"`);
    } catch (err: any) {
      if (err.status !== 1) throw err;
    }
  }
}
