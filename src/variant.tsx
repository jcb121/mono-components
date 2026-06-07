import { program } from "commander";

import fs, { existsSync } from "fs";
import path, {resolve} from "path";

program
  .name("variant")
  .command("create <name> <path>")
  .description("scaffold a new component variant at the given path")
  .action((sourcePath: string, targetPath: string) => {
    if (existsSync(sourcePath) && !existsSync(targetPath)) {
      deepCopyFolder(sourcePath, targetPath)
    }
  });

program.parse();


function deepCopyFolder(src: string, dest: string) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read all files/folders in the source
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // If it's a folder, recurse
      deepCopyFolder(srcPath, destPath);
    } else {
      // If it's a file, copy it
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
