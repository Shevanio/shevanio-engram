import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FIXTURE_FILES = [
  "compaction-recovery.js",
  "index.ts",
  "memory-tool-chrome.js",
  "private-redaction.js",
];

async function installRuntimeFixture(fixtureDir) {
  await Promise.all(FIXTURE_FILES.map((file) => copyFile(join(ROOT, file), join(fixtureDir, file))));

  const nodeModules = join(fixtureDir, "node_modules");
  await mkdir(join(nodeModules, "@earendil-works", "pi-tui"), { recursive: true });
  await writeFile(
    join(nodeModules, "@earendil-works", "pi-tui", "package.json"),
    JSON.stringify({ type: "module", exports: "./index.js" }),
  );
  await writeFile(
    join(nodeModules, "@earendil-works", "pi-tui", "index.js"),
    "export class Text { constructor(text) { this.text = text; } }\n",
  );

  await mkdir(join(nodeModules, "typebox"), { recursive: true });
  await writeFile(
    join(nodeModules, "typebox", "package.json"),
    JSON.stringify({ type: "module", exports: "./index.js" }),
  );
  await writeFile(
    join(nodeModules, "typebox", "index.js"),
    `const schema = (kind) => (...args) => ({ kind, args });
export const Type = new Proxy({}, { get: (_target, prop) => schema(String(prop)) });
`,
  );
}

test("registered Pi-native mem_search reports native provider transport failure", async () => {
  const fixtureDir = await mkdtemp(join(tmpdir(), "gentle-engram-native-tool-"));
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.ENGRAM_URL;
  process.env.ENGRAM_URL = "http://127.0.0.1:17437";
  globalThis.fetch = async () => {
    throw new Error("connection refused");
  };

  try {
    await installRuntimeFixture(fixtureDir);
    const registeredTools = new Map();
    const pluginUrl = pathToFileURL(join(fixtureDir, "index.ts"));
    const { default: registerEngram } = await import(pluginUrl.href);
    registerEngram({
      registerTool(tool) {
        registeredTools.set(tool.name, tool);
      },
      on() {},
    });

    const memSearch = registeredTools.get("mem_search");
    assert.ok(memSearch, "mem_search tool should be registered");

    const result = await memSearch.execute(
      "tool-call-1",
      { query: "state markers", project: "gentle-agent-state" },
      undefined,
      undefined,
      {
        cwd: ROOT,
        sessionManager: { getSessionId: () => "test-session" },
        ui: { setStatus() {} },
      },
    );

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /gentle-engram could not reach the Engram HTTP server/);
    assert.match(result.content[0].text, /Pi-native mem_\* tools are registered/);
    assert.match(result.details.error, /native memory provider is not currently responding/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.ENGRAM_URL;
    else process.env.ENGRAM_URL = originalUrl;
    await rm(fixtureDir, { recursive: true, force: true });
  }
});
