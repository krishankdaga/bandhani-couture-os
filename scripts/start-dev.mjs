import { spawn } from "node:child_process";
import { readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const lockPath = ".next-dev.lock";
const distDir = ".next-dev";
const port = String(process.env.PORT || 3000);

async function localGroqEnv() {
  try {
    const source = await readFile(".env", "utf8");
    const values = {};
    for (const name of ["GROQ_API_KEY", "GROQ_MODEL"]) {
      const line = source.split(/\r?\n/).find((entry) => new RegExp(`^\\s*${name}\\s*=`).test(entry));
      if (!line) continue;
      let value = line.split("=").slice(1).join("=").trim();
      if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) value = value.slice(1, -1).trim();
      values[name] = value;
    }
    return values;
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

async function processExists(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error?.code === "EPERM"; }
}

try {
  const existingPid = Number(await readFile(lockPath, "utf8"));
  if (Number.isInteger(existingPid) && await processExists(existingPid)) {
    console.error(`Bandhani Couture OS development server is already running (PID ${existingPid}). Stop that terminal with Ctrl+C before starting another.`);
    process.exit(1);
  }
  await unlink(lockPath).catch(() => {});
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

try {
  await writeFile(lockPath, String(process.pid), { flag: "wx" });
} catch (error) {
  if (error?.code === "EEXIST") {
    console.error("Another Bandhani Couture OS development server is starting. Wait for it or stop that terminal first.");
    process.exit(1);
  }
  throw error;
}

let cleaned = false;
async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  await unlink(lockPath).catch(() => {});
}

// Retry the clean: a just-killed Next process can still be writing into
// .next-dev, which makes a single rmdir fail with ENOTEMPTY/EBUSY.
await rm(distDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
console.log(`Cleaned ${distDir}`);

const nextBinary = path.join(process.cwd(), "node_modules", ".bin", "next");
const groqEnv = await localGroqEnv();
const child = spawn(nextBinary, ["dev", "-p", port], {
  stdio: "inherit",
  env: { ...process.env, ...groqEnv, NEXT_DIST_DIR: distDir },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", async (code) => {
  await cleanup();
  process.exit(code ?? 0);
});

process.on("exit", () => { if (!cleaned) void unlink(lockPath).catch(() => {}); });
