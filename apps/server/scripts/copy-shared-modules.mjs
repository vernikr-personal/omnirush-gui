// tsc emits only TypeScript: plain-JavaScript modules required at runtime
// (workspace, computer-use/shared, provider-lock, and box) are copied into dist.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const copied = [];
for (const folder of ["workspace", "computer-use/shared", "provider-lock", "box"]) {
  const from = join(root, "src", folder);
  const to = join(root, "dist", folder);
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from).filter((file) => file.endsWith(".mjs"))) {
    copyFileSync(join(from, name), join(to, name));
    copied.push(join(folder, name));
  }
}
process.stdout.write(`${JSON.stringify({ copied })}\n`);
