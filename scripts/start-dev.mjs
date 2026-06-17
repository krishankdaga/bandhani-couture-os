import { spawn, spawnSync } from "node:child_process";
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

// A lock is only "live" if its PID is BOTH running AND actually this project's dev
// process. This guards against a stale lock left behind when a previous server was
// force-killed (SIGKILL skips cleanup) or whose PID has since been reused by an
// unrelated process — either of which would otherwise block a fresh `npm run dev`.
function liveDevServer(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  const result = spawnSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout) return false;
  return /start-dev\.mjs|next/.test(result.stdout);
}

try {
  const existingPid = Number(await readFile(lockPath, "utf8"));
  if (liveDevServer(existingPid)) {
    console.error(`Bandhani Couture OS development server is already running (PID ${existingPid}). Stop that terminal with Ctrl+C before starting another.`);
    process.exit(1);
  }
  // Stale lock — reclaim it.
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
