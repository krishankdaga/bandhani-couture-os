import { rm } from "node:fs/promises";

const requested = process.argv.slice(2);
const directories = requested.length ? requested : [".next", ".next-dev", ".next-build"];
const allowed = new Set([".next", ".next-dev", ".next-build"]);

for (const directory of directories) {
  if (!allowed.has(directory)) throw new Error(`Refusing to clean unexpected path: ${directory}`);
  await rm(directory, { recursive: true, force: true });
  console.log(`Cleaned ${directory}`);
}
