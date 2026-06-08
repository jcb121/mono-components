#!/usr/bin/env node
import { program } from "commander";
import fs, { existsSync, globSync } from "fs";
import path from "path";
import os from "os";
import zlib from "zlib";
import { execSync } from "child_process";

const VARIANT_FILE = "variant.json";

interface VariantMeta {
  source: string;
  base: string; // brotli base64 of JSON.stringify(Record<relative path, file contents>)
}

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

function findVariants(sourcePath: string): string[] {
  const root = findPackageRoot();
  return globSync(`**/${VARIANT_FILE}`, { cwd: root, exclude: (p) => p.includes("node_modules") })
    .filter((f) => {
      const meta: VariantMeta = JSON.parse(fs.readFileSync(path.join(root, f), "utf-8"));
      return meta.source === sourcePath;
    })
    .map((f) => path.relative(process.cwd(), path.join(root, path.dirname(f))));
}

function readBaseSnapshot(targetPath: string): VariantMeta {
  const metaPath = path.join(targetPath, VARIANT_FILE);
  if (!existsSync(metaPath)) {
    console.error(`No variant.json found in ${targetPath}. Was it created with 'branch'?`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
}

function collectFiles(dir: string, rel = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      Object.assign(result, collectFiles(path.join(dir, entry.name), relPath));
    } else {
      result[relPath] = fs.readFileSync(path.join(dir, entry.name), "utf-8");
    }
  }
  return result;
}

function compressFiles(dir: string): string {
  const files = collectFiles(dir);
  return zlib.brotliCompressSync(JSON.stringify(files)).toString("base64");
}

function extractToDir(base: string, dir: string) {
  const files: Record<string, string> = JSON.parse(
    zlib.brotliDecompressSync(Buffer.from(base, "base64")).toString()
  );
  for (const [relPath, contents] of Object.entries(files)) {
    const dest = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, contents);
  }
}

try {
  execSync("git --version", { stdio: "ignore" });
} catch {
  console.error("git is not installed or not in PATH");
  process.exit(1);
}

program.name("variant");

program
  .command("branch <sourcePath> <targetPath>")
  .description("scaffold a new component variant at the given path")
  .action((sourcePath: string, targetPath: string) => {
    if (!existsSync(sourcePath)) {
      console.error(`Source does not exist: ${sourcePath}`);
      process.exit(1);
    }
    if (!fs.statSync(sourcePath).isDirectory()) {
      console.error(`Source must be a directory, not a file: ${sourcePath}`);
      process.exit(1);
    }
    if (existsSync(targetPath)) {
      console.error(`Target already exists: ${targetPath}`);
      process.exit(1);
    }

    deepCopyFolder(sourcePath, targetPath);

    const meta: VariantMeta = {
      source: sourcePath,
      base: compressFiles(sourcePath),
    };
    fs.writeFileSync(path.join(targetPath, VARIANT_FILE), JSON.stringify(meta, null, 2));

    console.log(`Branched ${sourcePath} → ${targetPath}`);
  });

program
  .command("rebase <sourcePath> [targetPath]")
  .description("apply upstream changes from source into the target variant")
  .option("--all", "rebase all variants branched from source")
  .option("--force", "rebase even if the target has downstream variants")
  .action((sourcePath: string, targetPath: string | undefined, options: { all?: boolean; force?: boolean }) => {
    const targets = options.all ? findVariants(sourcePath) : targetPath ? [targetPath] : [];

    if (targets.length === 0) {
      console.error("Specify a target path or use --all");
      process.exit(1);
    }

    for (const target of targets) {
      const downstream = findVariants(target);
      if (downstream.length > 0 && !options.force) {
        console.error(`Cannot rebase ${target}: it has downstream variants that would become stale:`);
        for (const d of downstream) console.error(`  ${d}`);
        console.error("Run with --force to rebase anyway.");
        process.exit(1);
      }

      const meta = readBaseSnapshot(target);

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "variant-base-"));
      try {
        extractToDir(meta.base, tmpDir);
        rebaseFolder(sourcePath, target, tmpDir);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }

      meta.base = collectFiles(sourcePath);
      fs.writeFileSync(path.join(target, VARIANT_FILE), JSON.stringify(meta, null, 2));

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


function deepCopyFolder(src: string, dest: string) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      deepCopyFolder(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function rebaseFolder(source: string, target: string, base: string) {
  const entries = new Set([
    ...fs.readdirSync(source),
    ...fs.readdirSync(target).filter((n) => n !== VARIANT_FILE),
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
      const relTarget = path.relative(process.cwd(), targetFile);
      const relSource = path.relative(process.cwd(), sourcePath);
      const relBase = path.relative(process.cwd(), baseFile);
      execSync(`git merge-file -L "${relTarget}" -L "${relBase}" -L "${relSource}" "${targetFile}" "${baseFile}" "${sourcePath}"`);
    } catch (err: any) {
      if (err.status !== 1) throw err;
    }
  }
}
