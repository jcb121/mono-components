#!/usr/bin/env node
import { program } from "commander";
import fs, { existsSync } from "fs";
import path from "path";
import { execSync } from "child_process";

const BASES_DIR = ".variant-bases";

try {
  execSync("git --version", { stdio: "ignore" });
} catch {
  console.error("git is not installed or not in PATH");
  process.exit(1);
}

program
  .name("variant")
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
    const baseSnapshot = path.join(BASES_DIR, baseName);
    deepCopyFolder(sourcePath, baseSnapshot, header);

    console.log(`Branched ${sourcePath} → ${targetPath}`);
  });

program
  .name("variant")
  .command("rebase <sourcePath> <targetPath>")
  .description("apply upstream changes from source into the target variant")
  .action((sourcePath: string, targetPath: string) => {
    const baseName = path.basename(path.resolve(targetPath));
    const baseSnapshot = path.join(BASES_DIR, baseName);

    if (!existsSync(baseSnapshot)) {
      console.error(`No base snapshot found for ${targetPath}. Was it created with 'branch'?`);
      process.exit(1);
    }

    rebaseFolder(sourcePath, targetPath, baseSnapshot);

    deepCopyFolder(sourcePath, baseSnapshot);

    console.log(`Rebased ${targetPath} onto ${sourcePath}`);
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
      // New file added in source — bring it into target
      fs.copyFileSync(sourcePath, targetFile);
      continue;
    }

    if (!existsSync(sourcePath)) {
      // File deleted in source — remove from target too
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
