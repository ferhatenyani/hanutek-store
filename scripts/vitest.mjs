// Windows: a lowercase drive letter in cwd (e.g. VS Code terminals report "c:\…")
// makes Vitest load two copies of itself ("failed to find the runner").
// Normalize the drive letter, then hand over to the real CLI.
import { spawnSync } from "node:child_process";

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
const bin = `${cwd}/node_modules/vitest/vitest.mjs`;
const r = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { cwd, stdio: "inherit" });
process.exit(r.status ?? 1);
