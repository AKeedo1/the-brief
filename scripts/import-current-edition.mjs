import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(projectRoot, "..", "daily-edition");
const targetRoot = resolve(projectRoot, "public", "edition");

await mkdir(targetRoot, { recursive: true });
for (const name of ["index.html", "styles.css", "app.js"]) {
  await copyFile(resolve(sourceRoot, name), resolve(targetRoot, name));
}

console.log("Imported the current Daily Edition shell.");
