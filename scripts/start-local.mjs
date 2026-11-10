import { createHash } from "node:crypto";
import { spawn, spawnSync, execFile } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, watch, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const sourceRoot = process.env.SENARI_GUILD_SOURCE_ROOT;
if (!sourceRoot || !existsSync(path.join(sourceRoot, "package.json"))) {
  throw new Error("Start this app with the Start Guild Manager shortcut in the guild-manager folder.");
}

const localRoot = path.join(
  process.env.LOCALAPPDATA || process.env.TEMP || process.cwd(),
  "SenariGuild",
  "guild-manager",
  "app",
);
const dataRoot = path.join(sourceRoot, ".wrangler", "state");
const excludedTopLevel = new Set([
  ".agents",
  ".codex",
  ".git",
  ".local-runtime",
  ".next",
  ".sites-runtime",
  ".vinext",
  ".wrangler",
  "dist",
  "node_modules",
  "outputs",
  "work",
]);

mkdirSync(localRoot, { recursive: true });

function shouldCopy(candidate) {
  const relative = path.relative(sourceRoot, candidate);
  if (!relative) return true;
  const parts = relative.split(path.sep);
  return (
    !excludedTopLevel.has(parts[0]) &&
    path.basename(candidate) !== "next-env.d.ts" &&
    !candidate.endsWith(".tsbuildinfo")
  );
}

function syncSource() {
  cpSync(sourceRoot, localRoot, { recursive: true, filter: shouldCopy });
}

syncSource();

const lockHash = createHash("sha256")
  .update(readFileSync(path.join(sourceRoot, "package.json")))
  .update(readFileSync(path.join(sourceRoot, "package-lock.json")))
  .digest("hex");
const markerPath = path.join(localRoot, ".guild-manager-dependencies");
const installedHash = existsSync(markerPath) ? readFileSync(markerPath, "utf8").trim() : "";

if (!existsSync(path.join(localRoot, "node_modules")) || installedHash !== lockHash) {
  console.log("Preparing local app dependencies. This is only needed on first launch or after dependency changes.");
  const install = spawnSync("npm.cmd", ["ci"], {
    cwd: localRoot,
    stdio: "inherit",
    windowsHide: true,
    shell: true,
  });
  if (install.error) throw install.error;
  if (install.status !== 0) process.exit(install.status ?? 1);
  writeFileSync(markerPath, `${lockHash}\n`, "utf8");
}

console.log("Preparing the local guild database if needed.");
const migration = spawnSync(
  process.execPath,
  [
    path.join(localRoot, "node_modules", "wrangler", "bin", "wrangler.js"),
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    path.join(localRoot, "wrangler.local.jsonc"),
    "--persist-to",
    dataRoot,
    "--file",
    path.join(localRoot, "drizzle", "0000_known_shiva.sql"),
  ],
  {
    cwd: localRoot,
    stdio: "inherit",
    windowsHide: true,
  },
);
if (migration.error) throw migration.error;
if (migration.status !== 0) process.exit(migration.status ?? 1);

const url = "http://127.0.0.1:5173/";
let syncTimer;
const watcher = watch(sourceRoot, { recursive: true }, (_event, filename) => {
  const relative = filename?.toString() ?? "";
  const firstSegment = relative.split(/[\\/]/, 1)[0];
  if (
    (firstSegment && excludedTopLevel.has(firstSegment)) ||
    relative.endsWith("next-env.d.ts") ||
    relative.endsWith(".tsbuildinfo")
  ) return;

  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    try {
      syncSource();
      console.log("Synced updated source to the local app.");
      if (relative.endsWith("package.json") || relative.endsWith("package-lock.json")) {
        console.log("Dependencies changed. Restart this shortcut to install the updated packages.");
      }
    } catch (error) {
      console.warn("Could not sync a source change yet; it will retry after the next edit.", error);
    }
  }, 400);
});
watcher.on("error", (error) => {
  console.warn("Source watching stopped; restart this shortcut to pick up changes.", error);
});

const server = spawn(
  "npm.cmd",
  ["run", "dev", "--", "--port", "5173", "--hostname", "127.0.0.1"],
  {
    cwd: localRoot,
    env: { ...process.env, SENARI_GUILD_DATA_DIR: dataRoot },
    stdio: "inherit",
    windowsHide: true,
    shell: true,
  },
);

let stopped = false;
server.on("exit", (code) => {
  clearTimeout(syncTimer);
  watcher.close();
  stopped = true;
  process.exitCode = code ?? 1;
});

for (let attempt = 0; attempt < 90 && !stopped; attempt += 1) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1000) });
    await execFileAsync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `start "" "${url}"`], {
      windowsHide: true,
    });
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

if (!stopped) {
  await new Promise((resolve) => server.once("exit", resolve));
}
