import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CLI = join(ROOT, "cli.js");

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function runInit(agentDir) {
  return execFileAsync(process.execPath, [CLI, "init"], {
    env: { ...process.env, PI_CODING_AGENT_DIR: agentDir },
  });
}

test("package metadata and CLI help use the canonical identity", async () => {
  const metadata = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  assert.equal(metadata.name, "shevanio-engram");
  assert.equal(metadata.version, "0.1.10");
  assert.equal(metadata.author, "Shevanio");
  assert.equal(metadata.homepage, "https://github.com/Shevanio/shevanio-engram");
  assert.deepEqual(metadata.repository, {
    type: "git",
    url: "git+https://github.com/Shevanio/shevanio-engram.git",
  });
  assert.match(metadata.pi.image, /Shevanio\/shevanio-engram\/main\/assets\/engram-logo-only\.png$/);

  const { stdout } = await execFileAsync(process.execPath, [CLI]);
  assert.match(stdout, /npm:shevanio-engram@0\.1\.10/);
  assert.doesNotMatch(stdout, /npm:gentle-engram/);
});

test("init migrates only exact legacy npm registrations and is idempotent", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-cli-migration-"));
  const agentDir = join(root, "agent");
  const settingsPath = join(agentDir, "settings.json");
  const mcpPath = join(agentDir, "mcp.json");
  const localFile = join(agentDir, ".pi", "gentle-ai", "keep.txt");
  const cacheFile = join(agentDir, "package-cache", "gentle-engram", "keep.txt");
  const legacyObject = {
    source: "npm:gentle-engram@0.1.8",
    include: ["src/**"],
    exclude: ["test/**"],
    autoload: false,
    custom: { retained: true },
  };
  const untouched = [
    "./.pi/gentle-ai",
    "npm:gentle-engram-tools@2",
    "npm:@legacy/gentle-engram@1",
    { source: "../gentle-engram", unknown: "kept" },
    "npm:other@1",
  ];
  const customMcp = { mcpServers: { engram: { command: "custom", args: ["serve"] } }, extra: true };

  try {
    await writeJson(settingsPath, { packages: ["npm:gentle-engram", legacyObject, ...untouched], theme: "dark" });
    await writeJson(mcpPath, customMcp);
    await writeJson(localFile, { keep: true });
    await writeJson(cacheFile, { keep: true });

    const first = await runInit(agentDir);
    const migrated = JSON.parse(await readFile(settingsPath, "utf8"));
    assert.deepEqual(migrated, {
      packages: [
        "npm:shevanio-engram@0.1.10",
        { ...legacyObject, source: "npm:shevanio-engram@0.1.10" },
        ...untouched,
        "npm:pi-mcp-adapter",
      ],
      theme: "dark",
    });
    assert.match(first.stdout, /Updated npm:shevanio-engram@0\.1\.10/);
    assert.deepEqual(JSON.parse(await readFile(mcpPath, "utf8")), customMcp);
    await Promise.all([access(localFile), access(cacheFile)]);

    const settingsAfterFirstRun = await readFile(settingsPath, "utf8");
    const mcpAfterFirstRun = await readFile(mcpPath, "utf8");
    const second = await runInit(agentDir);
    assert.equal(await readFile(settingsPath, "utf8"), settingsAfterFirstRun);
    assert.equal(await readFile(mcpPath, "utf8"), mcpAfterFirstRun);
    assert.match(second.stdout, /Kept npm:shevanio-engram@0\.1\.10/);
    await Promise.all([access(localFile), access(cacheFile)]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("init preserves a canonical pin and removes only exact rewritten duplicates", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-cli-pin-"));
  const agentDir = join(root, "agent");
  const settingsPath = join(agentDir, "settings.json");
  const canonical = "npm:shevanio-engram@next";
  const sharedFields = { include: ["src/**"], custom: { retained: true } };

  try {
    await writeJson(settingsPath, {
      packages: [
        canonical,
        canonical,
        "npm:gentle-engram",
        "npm:gentle-engram@latest",
        { source: canonical, ...sharedFields },
        { source: "npm:gentle-engram@0.1.8", ...sharedFields },
        { source: "npm:gentle-engram", include: ["test/**"], autoload: false },
        { source: canonical, exclude: ["docs/**"] },
      ],
    });
    await runInit(agentDir);

    assert.deepEqual(JSON.parse(await readFile(settingsPath, "utf8")).packages, [
      canonical,
      { source: canonical, ...sharedFields },
      { source: canonical, include: ["test/**"], autoload: false },
      { source: canonical, exclude: ["docs/**"] },
      "npm:pi-mcp-adapter",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
