import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PACKAGE_FACING_TEXT = [
  "package.json",
  "cli.js",
  "index.ts",
  "compaction-recovery.js",
  "memory-tool-chrome.js",
  "private-redaction.js",
  "mcp-template.json",
  "README.md",
];
const KNOWN_LEGACY_IDENTITY = /gentle-engram|gentle-ai|gentleman(?:[\s._-]|%20)*programming/giu;

let packDryRunPromise;

async function readManifest() {
  return JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
}

function packDryRun() {
  packDryRunPromise ??= execFileAsync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    { cwd: ROOT },
  ).then(({ stdout }) => JSON.parse(stdout));
  return packDryRunPromise;
}

function legacyIdentityMatches(source) {
  return [...source.matchAll(KNOWN_LEGACY_IDENTITY)];
}

function lineContaining(source, index) {
  const start = source.lastIndexOf("\n", index - 1) + 1;
  const end = source.indexOf("\n", index);
  return source.slice(start, end === -1 ? source.length : end);
}

function paragraphContaining(source, index) {
  const before = source.slice(0, index);
  const startBoundary = before.lastIndexOf("\n\n");
  const endBoundary = source.indexOf("\n\n", index);
  return source.slice(startBoundary === -1 ? 0 : startBoundary + 2, endBoundary === -1 ? source.length : endBoundary);
}

function isLegacyMigrationConstant(source, match) {
  return match[0] === "gentle-engram"
    && lineContaining(source, match.index).trim() === 'const LEGACY_PACKAGE_NAME = "gentle-engram";';
}

function isReadmeMigrationCompatibility(source, match) {
  if (match[0] !== "gentle-engram") return false;
  const paragraph = paragraphContaining(source, match.index);
  return paragraph.includes("`pi-engram init`")
    && /rewrites only exact registered npm sources/i.test(paragraph)
    && /preserves canonical pins/i.test(paragraph)
    && /never scans or deletes/i.test(paragraph);
}

function isReadmeDistributionStatus(source, match) {
  const line = lineContaining(source, match.index);
  return line.includes("`gentle-engram@0.1.10`")
    && /Upstream compatibility artifact/i.test(line);
}

function isReadmeUpstreamSetupBoundary(source, match) {
  const paragraph = paragraphContaining(source, match.index);
  return paragraph.includes("`engram setup pi`")
    && /upstream compatibility/i.test(paragraph)
    && /Do not use `engram setup pi`/i.test(paragraph);
}

test("package manifest preserves the downstream Pi consumer surface", async () => {
  const manifest = await readManifest();

  assert.equal(manifest.name, "shevanio-engram");
  assert.equal(manifest.version, "0.1.10");
  assert.equal(manifest.type, "module");
  assert.deepEqual(manifest.bin, { "pi-engram": "cli.js" });
  assert.deepEqual(manifest.pi.extensions, ["./index.ts"]);
  assert.equal(manifest.author, "Shevanio");
  assert.deepEqual(manifest.repository, {
    type: "git",
    url: "git+https://github.com/Shevanio/shevanio-engram.git",
  });
  assert.equal(manifest.homepage, "https://github.com/Shevanio/shevanio-engram");
  assert.equal("image" in manifest.pi, false);
  assert.equal(manifest.files.includes("assets/"), false);

  const requiredFiles = [
    "cli.js",
    "compaction-recovery.js",
    "index.ts",
    "memory-tool-chrome.js",
    "mcp-template.json",
    "private-redaction.js",
    "docs/ci.md",
    "README.md",
    "LICENSE",
    "NOTICE",
    "TRADEMARKS.md",
    "package.json",
  ];
  for (const path of requiredFiles) assert.ok(manifest.files.includes(path), `package files must include ${path}`);
});

test("package dry-run contains the required consumer files without writing a tarball", async () => {
  const manifest = await readManifest();
  const packs = await packDryRun();

  assert.equal(packs.length, 1);
  assert.equal(packs[0].name, manifest.name);
  assert.equal(packs[0].version, manifest.version);

  const packedPaths = new Set(packs[0].files.map(({ path }) => path));
  const requiredPackedPaths = [
    "package.json",
    "cli.js",
    "index.ts",
    "compaction-recovery.js",
    "memory-tool-chrome.js",
    "private-redaction.js",
    "mcp-template.json",
    "docs/ci.md",
    "README.md",
    "LICENSE",
    "NOTICE",
    "TRADEMARKS.md",
  ];
  for (const path of requiredPackedPaths) assert.ok(packedPaths.has(path), `dry-run package must include ${path}`);
  assert.equal(packedPaths.has("assets/engram-logo-only.png"), false);

  const tarballs = (await readdir(ROOT)).filter((path) => path.endsWith(".tgz"));
  assert.deepEqual(tarballs, [], "npm pack --dry-run must not leave a tarball");
});

test("package-facing active text contains only bounded legacy identity allowances", async () => {
  const sources = new Map(await Promise.all(PACKAGE_FACING_TEXT.map(async (path) => [
    path,
    await readFile(join(ROOT, path), "utf8"),
  ])));
  const allowed = [];
  const unexpected = [];

  for (const [path, source] of sources) {
    for (const match of legacyIdentityMatches(source)) {
      const isAllowed = path === "cli.js"
        ? isLegacyMigrationConstant(source, match)
        : path === "README.md"
          && (
            isReadmeDistributionStatus(source, match)
            || isReadmeMigrationCompatibility(source, match)
            || isReadmeUpstreamSetupBoundary(source, match)
          );
      if (isAllowed) {
        allowed.push(`${path}:${match[0]}`);
      } else {
        const line = source.slice(0, match.index).split("\n").length;
        unexpected.push(`${path}:${line}:${match[0]}`);
      }
    }
  }

  assert.deepEqual(allowed, [
    "cli.js:gentle-engram",
    "README.md:gentle-engram",
    "README.md:gentle-engram",
    "README.md:Gentleman-Programming",
    "README.md:gentle-engram",
  ]);
  assert.deepEqual(unexpected, []);
});
