#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";

const PACKAGE_SOURCE = "npm:shevanio-engram@0.1.10";
const CANONICAL_PACKAGE_NAME = "shevanio-engram";
const LEGACY_PACKAGE_NAME = "gentle-engram";
const MCP_ADAPTER_PACKAGE = "npm:pi-mcp-adapter";
const HELP = `pi-engram

Usage:
  pi-engram init [--force]

Creates Pi's Engram MCP config in the Pi agent dir and ensures pi-mcp-adapter
is declared in settings.json. The Pi extension itself is loaded by installing
the package with: pi install npm:shevanio-engram@0.1.10
`;

const MCP_LAUNCHER =
  "const { spawn } = require('node:child_process'); const bin = process.env.ENGRAM_BIN || 'engram'; const child = spawn(bin, ['mcp', '--tools=agent'], { stdio: 'inherit' }); child.on('error', () => process.exit(127)); child.on('exit', (code, signal) => { if (typeof code === 'number') process.exit(code); process.kill(process.pid, signal || 'SIGTERM'); });";

function getAgentDir() {
  return process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
}

function readJsonObject(filePath) {
  if (!existsSync(filePath)) return {};
  const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${filePath} must contain a JSON object`);
  }
  return parsed;
}

function writeJsonObject(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function ensurePackage(settingsPath, packageName) {
  const settings = readJsonObject(settingsPath);
  const packages = Array.isArray(settings.packages) ? settings.packages : [];
  if (!packages.includes(packageName)) {
    settings.packages = [...packages, packageName];
    writeJsonObject(settingsPath, settings);
    return true;
  }
  return false;
}

function registeredSource(entry) {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object" && !Array.isArray(entry)) return entry.source;
  return undefined;
}

function isExactNpmPackageSource(source, packageName) {
  const parsed = typeof source === "string" && /^npm:([^@/]+)(?:@[^/]+)?$/.exec(source);
  return parsed?.[1] === packageName;
}

function migratePackageRegistration(settingsPath) {
  const settings = readJsonObject(settingsPath);
  const packages = Array.isArray(settings.packages) ? settings.packages : [];
  const canonicalSource = packages
    .map(registeredSource)
    .find((source) => isExactNpmPackageSource(source, CANONICAL_PACKAGE_NAME)) || PACKAGE_SOURCE;

  const migrated = packages.map((entry) => {
    if (!isExactNpmPackageSource(registeredSource(entry), LEGACY_PACKAGE_NAME)) return entry;
    return typeof entry === "string" ? canonicalSource : { ...entry, source: canonicalSource };
  });
  if (!migrated.some((entry) => isExactNpmPackageSource(registeredSource(entry), CANONICAL_PACKAGE_NAME))) {
    migrated.push(PACKAGE_SOURCE);
  }

  const deduplicated = migrated.filter(
    (entry, index) => migrated.findIndex((candidate) => isDeepStrictEqual(candidate, entry)) === index,
  );
  if (Array.isArray(settings.packages) && isDeepStrictEqual(packages, deduplicated)) return false;
  settings.packages = deduplicated;
  writeJsonObject(settingsPath, settings);
  return true;
}

function createEngramServerConfig() {
  return {
    command: "node",
    args: ["-e", MCP_LAUNCHER],
    lifecycle: "lazy",
    directTools: false,
  };
}

function ensureMcpConfig(mcpPath, force) {
  const config = readJsonObject(mcpPath);
  const existingServers = config.mcpServers && typeof config.mcpServers === "object" && !Array.isArray(config.mcpServers)
    ? config.mcpServers
    : {};

  if (existingServers.engram && !force) {
    return false;
  }

  config.mcpServers = {
    ...existingServers,
    engram: createEngramServerConfig(),
  };
  writeJsonObject(mcpPath, config);
  return true;
}

function init() {
  const force = process.argv.includes("--force");
  const agentDir = getAgentDir();
  const settingsPath = join(agentDir, "settings.json");
  const mcpPath = join(agentDir, "mcp.json");

  const packageChanged = migratePackageRegistration(settingsPath);
  const adapterChanged = ensurePackage(settingsPath, MCP_ADAPTER_PACKAGE);
  const mcpChanged = ensureMcpConfig(mcpPath, force);

  console.log(`Pi agent dir: ${agentDir}`);
  console.log(`${adapterChanged ? "Added" : "Kept"} ${MCP_ADAPTER_PACKAGE} in settings.json`);
  console.log(`${packageChanged ? "Updated" : "Kept"} ${PACKAGE_SOURCE} in settings.json`);
  console.log(`${mcpChanged ? "Wrote" : "Kept existing"} Engram MCP server in mcp.json`);
  console.log("Set ENGRAM_URL for an existing engram serve instance, or ENGRAM_BIN for a custom engram binary path.");
}

const command = process.argv[2];
if (command === "init") {
  init();
} else {
  console.log(HELP);
}
