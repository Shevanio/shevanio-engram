# Shevanio Engram for Pi

<p align="center">
  <a href="https://github.com/Shevanio/shevanio-engram"><img alt="GitHub stars" src="https://img.shields.io/github/stars/Shevanio/shevanio-engram?style=flat&color=yellow" /></a>
  <a href="https://github.com/Shevanio/shevanio-engram/graphs/contributors"><img alt="Contributors" src="https://img.shields.io/github/contributors/Shevanio/shevanio-engram?color=brightgreen" /></a>
  <a href="https://github.com/Shevanio/shevanio-engram/actions"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/Shevanio/shevanio-engram/ci.yml?label=CI" /></a>
  <a href="https://github.com/Shevanio/shevanio-engram/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/Shevanio/shevanio-engram" /></a>
</p>

`shevanio-engram` is the canonical package and repository identity for Shevanio's downstream Pi memory extension. It connects Pi to an Engram server; it does not ship the Engram Go binary. See [NOTICE](NOTICE) for the imported source baseline and [TRADEMARKS.md](TRADEMARKS.md) for the bounded use of upstream names.

## Current distribution status

Registry status was checked without authentication on 2026-09-03.

| npm coordinate | Status | Role |
| -------------- | ------ | ---- |
| `shevanio-engram` | **Unpublished** (`npm view` returns `E404`) | Canonical package for this repository |
| `shevanio-pi` | **Unpublished** (`npm view` returns `E404`) | Canonical companion identity, not built by this repository |
| `gentle-engram@0.1.10` | Published | Upstream compatibility artifact, not the canonical Shevanio distribution |
| `gentle-pi@2.3.0` | Published | Upstream compatibility artifact, not the canonical Shevanio distribution |

> Do not run `pi install npm:shevanio-engram@0.1.10`. The canonical coordinate is not available from npm yet.

## Supported source-checkout path

Use a local checkout for development until the canonical package is published:

```bash
git clone https://github.com/Shevanio/shevanio-engram.git
cd shevanio-engram
npm install --ignore-scripts --no-package-lock --no-audit --no-fund
npm test
npm pack --dry-run --json --ignore-scripts
pi install "$PWD"
```

CI verifies this path with Node.js 22. It also requires a Pi version that supports local package paths and an `engram` binary on `PATH` (or `ENGRAM_BIN` set to its absolute path). Restart Pi after `pi install "$PWD"`.

Do not run `pi-engram init` for the local-checkout path. The current initializer records the reserved `npm:shevanio-engram@0.1.10` source in Pi settings, which cannot resolve before publication.

## Package behavior

| Path | Purpose |
| ---- | ------- |
| Pi extension | Captures prompts and session events, injects the memory protocol, and exposes compact Pi-native `mem_*` tools over the Engram HTTP server. |
| Optional MCP gateway | Uses `pi-mcp-adapter` and `engram mcp --tools=agent` for clients or flows that require MCP directly. |

```text
Pi events/tools -> shevanio-engram extension -> ENGRAM_URL / engram serve -> SQLite
Pi MCP tools   -> pi-mcp-adapter -> ENGRAM_BIN / engram mcp -> SQLite
```

When `ENGRAM_URL` is unset, the extension checks the local server and best-effort starts `engram serve` if needed. MCP remains a separate stdio path and still requires an Engram binary. Direct MCP tools are disabled by default in Pi to avoid duplicate raw `engram_mem_*` rows alongside the Pi-native tools.

## Verification

Run `npm test` for the complete test contract and `npm pack --dry-run --json --ignore-scripts` for the no-publish consumer check. The deployed workflow, exact `verify` job, local equivalent, permissions, branch protection, and no-release boundary are documented in [docs/ci.md](docs/ci.md).

## At a glance

| You want                    | Engram gives Pi                                  |
| --------------------------- | ------------------------------------------------ |
| Fewer repeated explanations | Searchable memories from previous sessions       |
| Lower context waste         | Curated saves instead of raw tool-call dumps     |
| Continuity after compaction | Required session summaries and recovery protocol |
| One memory across tools     | Shared MCP-backed memory for Pi and other agents |
| Team/project memory         | Optional Engram Cloud replication and dashboard  |

## Why this is different from “more context”

Context windows are temporary. Engram is memory.

| More context                        | Engram memory                                            |
| ----------------------------------- | -------------------------------------------------------- |
| Helps during the current run        | Helps across sessions, agents, machines, and compactions |
| Often includes raw logs/tool output | Stores curated, searchable knowledge                     |
| Gets summarized away                | Persists in SQLite + FTS5                                |
| Usually tied to one agent           | Works through MCP across agent clients                   |

Engram does not try to make the model read everything. It gives the model a disciplined memory protocol: save important knowledge, search before repeating work, and fetch full details only when needed.

## See the memory

Engram includes a terminal UI for browsing sessions, observations, prompts, projects, timelines, and search results. Engram Cloud adds browser visibility for shared project memory.

Pi-native compact tools use the same HTTP server path as event capture, including project detection, diagnostics, passive capture, lifecycle review, and conflict-judgment tools such as `mem_current_project`, `mem_doctor`, `mem_capture_passive`, `mem_review`, `mem_judge`, and `mem_compare`. MCP tools remain a separate stdio path, so direct MCP usage still needs an Engram binary even when `ENGRAM_URL` points at a remote HTTP server. Engram MCP direct tools are not enabled by default in Pi to avoid duplicate raw `engram_mem_*` tool rows.

## Compact memory tool rendering

`shevanio-engram` owns the Pi chrome for Engram memory tools by registering compact Pi-native `mem_*` tools in the companion package. When tools such as `mem_search`, `mem_context`, `mem_save`, `mem_session_summary`, `mem_get_observation`, `mem_review`, `mem_judge`, and `mem_doctor` run in Pi, the default collapsed view stays compact:

```text
🧠 search “auth model” …
↳ ✓ 4 results
```

For lifecycle review, `mem_review` keeps the collapsed output explicit without exposing raw tool payloads:

```text
🧠 review list “engram” limit 10 …
↳ ✓ 3 need review

🧠 review mark_reviewed #42 …
↳ ✓ reviewed #42
```

`action=list` shows memories whose local `review_after` timestamp is due. `action=mark_reviewed` asks Engram core to reset that observation's local review clock according to its memory type. That review reset is local-only today: it updates the local lifecycle metadata but is not treated as a cloud/git sync mutation until the sync wire format carries lifecycle review fields.

Normal memory activity also updates the status bar with short progress/result text such as `🧠 engram · search…` and `🧠 engram · ✓ 4 results`. The extension does not use notifications for normal memory operations.

When a tool call fails because Engram cannot determine which project to use, the status bar shows an actionable label instead of the generic `error`:

| Status bar label           | Meaning                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `🧠 repos · ambiguous project` | Pi was started from a directory that contains multiple git repos. Run Pi from inside a single repo, or add `.engram/config.json` with `project_name` to the parent directory. |
| `🧠 repos · error`         | A different tool or network error occurred. Expand the tool output in Pi for the full error message.  |

Full tool details remain available by expanding the tool output in Pi. If `shevanio-engram` or the Engram server is not installed/running, the compact tool reports an error instead of implying memory is available.

## What Pi can remember

- Architecture decisions and tradeoffs
- Bug fixes, root causes, and gotchas
- User preferences and project conventions
- Session goals, next steps, and handoff summaries
- Prompt context tied to meaningful saved observations
- Cross-machine/team memory once a project is enrolled in Engram Cloud

## Private blocks

`shevanio-engram` redacts explicit private blocks before sending captured prompts, passive observations, or compaction summaries to Engram:

```text
<private>
this should not be persisted verbatim
</private>
```

The persisted payload keeps the surrounding text but replaces the private block with `[REDACTED]`. Redaction is applied recursively to string values in outgoing JSON payloads and to query values in Engram HTTP requests.

This is a lightweight convenience convention, not a full secret-scanning system. Do not rely on it to detect credentials automatically.

## Compaction recovery

When Pi emits a compaction lifecycle event, `shevanio-engram` best-effort extracts a compacted summary from supported event fields and saves it as a `session_summary` observation with topic key `session/compaction-recovery`.

Unsupported event shapes fail gracefully. The extension still injects a manual recovery instruction containing `FIRST ACTION REQUIRED`, so the next agent turn can call `mem_session_summary` if the Engram MCP tools are installed and active. If the tools are unavailable, save the compacted summary manually after Engram is available again.

## Local, sync, or cloud

Engram can grow with your workflow:

| Mode         | Use it when                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------- |
| Local SQLite | You want fast private memory on one machine.                                                |
| Git sync     | You want portable compressed memory chunks without a hosted service.                        |
| Engram Cloud | You want shared project memory, browser visibility, and replication across machines/agents. |

Cloud is opt-in and project-scoped. Local SQLite remains the source of truth; cloud replicates and makes memory visible when you explicitly enroll a project.

## Requirements

- Pi coding agent with npm package support.
- Engram installed as `engram` on `PATH`, or `ENGRAM_BIN` pointing at the binary.
- `pi-mcp-adapter` only if you want the optional MCP gateway for compatibility/debugging; Pi-native `mem_*` tools come from `shevanio-engram`.

If you only want HTTP session capture against an already running Engram server, set `ENGRAM_URL` and the extension will not auto-start a local `engram serve` process.

## Configuration

### Existing Engram server

Use an already running Engram HTTP server:

```bash
ENGRAM_URL=http://127.0.0.1:7437 pi
```

When `ENGRAM_URL` is set, the extension treats the server as externally managed and does not auto-start `engram serve`.

### Custom Engram binary

Use a custom Engram binary for MCP tools and local auto-start:

```bash
ENGRAM_BIN=/path/to/engram pi
```

If the binary is missing, Pi keeps running and memory degrades instead of crashing with `spawn engram ENOENT`.

## Setup command boundaries

### `pi-engram init`

The packaged `pi-engram init` command is reserved for a future verified canonical npm release. It writes Pi-owned config in the Pi agent directory:

- `settings.json`: ensures `npm:pi-mcp-adapter` and `npm:shevanio-engram@0.1.10` are declared.
- `mcp.json`: adds an `engram` MCP server that launches `engram mcp --tools=agent` through a safe Node wrapper with `directTools: false`, so MCP remains available through the gateway without duplicating Pi-native `mem_*` tools.

Existing `mcpServers.engram` entries are preserved unless you pass `--force`:

```bash
"${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/npm/node_modules/.bin/pi-engram" init --force
```

The command respects `PI_CODING_AGENT_DIR`; otherwise it writes to `~/.pi/agent`.

For migration, `pi-engram init` rewrites only exact registered npm sources for `gentle-engram`, with or without a version or tag. It preserves canonical pins, object filters and custom fields, and custom `mcpServers.engram` configuration. It never scans or deletes package caches, local paths, filesystem directories, or similarly named packages.

### Upstream `engram setup pi`

`engram setup pi` belongs to [upstream Engram core](https://github.com/Gentleman-Programming/engram/blob/55ee745a767de52c8a43180fd55fd9c19f880c79/internal/setup/setup.go), not this repository. At upstream commit `55ee745`, it runs `pi install npm:gentle-engram@0.1.11`; that upstream compatibility coordinate is unavailable, while npm reports `0.1.10` as its latest published version. Do not use `engram setup pi` to install canonical Shevanio Engram or this source checkout.

## Project detection

The HTTP event-capture path mirrors Engram's normal project detection order as closely as a Pi adapter can:

1. nearest `.engram/config.json` inside the current git repo
2. git `origin` remote name
3. git root directory name
4. single child git repo name
5. current directory basename

MCP tool calls still use Engram core's canonical project resolver at call time. Pi-native tool calls ask the Engram HTTP server for `/project/current`; if that route is missing on an older running server, the adapter falls back to the nearest local `.engram/config.json` and returns a version-mismatch warning. For critical repos or monorepos, prefer an explicit `.engram/config.json`:

```json
{
  "project_name": "my-project"
}
```

## Troubleshooting

| Symptom                                                      | Fix                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mem_*` tools are missing                                    | After registry publication is verified, install `npm:shevanio-engram@0.1.10`, run `"${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/npm/node_modules/.bin/pi-engram" init`, then restart Pi. Keep `npm:pi-mcp-adapter` installed if you use MCP integrations such as Notion or direct MCP flows.                                            |
| Pi cannot find `engram`                                      | Set `ENGRAM_BIN=/absolute/path/to/engram`.                                                                                                                                                                                                                              |
| Session capture should use another server                    | Set `ENGRAM_URL=http://host:7437`.                                                                                                                                                                                                                                      |
| Pi shows `error MCP: 0/N servers` but `mem_*` works          | That status is Pi's global MCP gateway, not proof that Engram's Pi-native HTTP tools failed. Check `~/.pi/agent/mcp.json` for stale/unreachable servers such as remote OAuth services, and keep `npm:pi-mcp-adapter` installed if you use MCP integrations like Notion. |
| Existing MCP config was not replaced                         | Run `"${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/npm/node_modules/.bin/pi-engram" init --force`.                                                                                                                                                                           |
| `mem_current_project` reports `/project/current` unsupported | Restart or upgrade the running `engram serve`; check `ENGRAM_URL`/`ENGRAM_BIN`. If `.engram/config.json` exists, Pi uses it as a temporary fallback.                                                                                                                    |
| `mem_session_summary` cannot detect a project                | Ask the user which project should receive the summary, then retry `mem_session_summary` with `project: "name"`.                                                                                                                                                         |
| Status bar shows `🧠 repos · ambiguous project`             | Pi was started from a parent directory that contains multiple git repos. Run Pi from inside a single repo, or add `.engram/config.json` with `"project_name": "my-project"` to the ambiguous directory.                                                                 |

## Next steps

- Run `engram tui` to inspect stored memories.
- Use `mem_current_project` to confirm project detection before writing memories.
- Review the [CI and package verification contract](docs/ci.md).
- Review the package source and report issues: <https://github.com/Shevanio/shevanio-engram>
