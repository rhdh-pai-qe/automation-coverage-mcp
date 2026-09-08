# Automation Coverage MCP

Coverage-driven test generation for the RHDH plugin forest. This MCP analyzes git changes, reads Istanbul/LCOV numbers, and tells agents **which tests to write at which layer**. UI work is handed to [Playwright MCP](https://github.com/microsoft/playwright-mcp) as explore-then-write briefs — this server does not drive a browser.

Plugins live at multiple levels (`workspaces/<ws>/plugins/<plugin>`, backend modules, overlay e2e, RHDH product e2e). Discovery walks that layout instead of hardcoding package names.

## What it does

1. **Discover** packages across `rhdh-plugins`, `community-plugins`, `rhdh`, `rhdh-plugin-export-overlays`, and shared Playwright helper repos.
2. **Analyze** the current git diff (branch vs `origin/main` plus uncommitted work) and classify each file (util, React page, backend router, overlay metadata, platform, …). When the branch is clean, pass `mode=workspace` to scan `src` instead.
3. **Read coverage** (`coverage/coverage-final.json` or `lcov.info`) from the **cwd / scoped packages only** (never a sibling workspace) and intersect uncovered lines with the diff.
4. **Recommend layers** using the cheapest-layer-wins ladder (unit → integration → component → plugin Playwright → overlay/cluster). Layers are pluggable YAML.
5. **Emit briefs** agents can execute. UI briefs are Playwright MCP prompts: navigate, snapshot, generate locators, verify, then write the spec.

Coverage ranks gaps. It is not a merge gate. Each brief states the **failure the test must catch**.

## Pair with Playwright MCP and Jira

Add all three servers to Cursor MCP config (`~/.cursor/mcp.json`, or `.cursor/mcp.json` in this clone). Playwright needs the testing capability so `browser_generate_locator` and `browser_verify_*` are available. Atlassian MCP reads Jira tickets so agents can complete automation work from RHIDP / RHDHBUGS keys.

**Jira auth (one-time):** Restart Cursor after editing mcp.json → Settings → Tools & MCP → toggle `atlassian` → ask the agent to read a ticket → complete OAuth and select `redhat.atlassian.net`.

Substitute **`<ABS_PATH_TO_THIS_CLONE>`** with the absolute path of this repository on your machine (the directory that contains `src/index.ts`).

```json
{
  "mcpServers": {
    "atlassian": {
      "url": "https://mcp.atlassian.com/v2/mcp"
    },
    "automation-coverage": {
      "command": "npx",
      "args": ["tsx", "<ABS_PATH_TO_THIS_CLONE>/src/index.ts"]
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--caps=testing"]
    }
  }
}
```

If the Cursor workspace *is* this repository, you can use the relative entry already in `.cursor/mcp.json` (`./src/index.ts`) instead of an absolute path.

Agent loop for UI gaps:

`generate_playwright_brief` → Playwright `browser_navigate` → `browser_snapshot` → interact → `browser_generate_locator` → `browser_verify_*` → write `@playwright/test` spec mirroring a neighbor → run until green.

Do not write Playwright from the scenario paragraph alone.

## Tools

| Tool | Purpose |
| --- | --- |
| `list_layers` | Builtin + YAML layers |
| `discover_packages` | Plugin packages at every forest level |
| `analyze_changes` | Git diff → package + file kind |
| `get_coverage` | Parse Istanbul/LCOV |
| `coverage_gaps` | Uncovered ∩ changed lines |
| `inventory_tests` | Existing tests (templates to mirror) |
| `recommend_automation` | Cheapest layers + Playwright flag |
| `generate_test_plan` | Full ordered plan with briefs. `mode=workspace` fills layers on a clean branch |
| `generate_layer_brief` | One layer (unit / integration / …) |
| `generate_playwright_brief` | Playwright MCP prompt from UI gaps |
| `plan_qe_from_feature` | Feature text → QE Epic + one Story per cheapest layer (Jira payloads; does not create issues) |
| `groom_qe_tickets` | Same plan merged into existing epic/children for `editJiraIssue` |

Prompts: `fill_automation_gaps`, `playwright_from_coverage`, `unit_from_coverage`, `jira_ticket_to_coverage`, `feature_to_qe_tickets`.

## Jira-driven workflow

Use the **jira-automation-coverage** skill (`~/.cursor/skills/jira-automation-coverage/SKILL.md`) or prompt `jira_ticket_to_coverage`:

1. **Atlassian MCP** — read ticket (summary, component, acceptance criteria).
2. **Classify** — product bugs → `bug-fix`; coverage/e2e gaps → continue.
3. **Map** — Jira Component → `workspaces/<name>` in rhdh-plugins.
4. **automation-coverage MCP** — `generate_test_plan` with `cwd` set to that workspace.
5. **Execute** — implement every work item; Playwright MCP for UI layers.
6. **Atlassian MCP** — comment on the ticket with results.

Example: `Complete RHIDP-12345 — fill scorecard automation gaps.`

## Feature → QE epic / stories

Reverse of the above: a **product Feature** (paste or `RHDHPLAN-…`) becomes a `[QE]` epic plus `[L1]`/`[L3]`/`[L4a]` stories.

1. Atlassian MCP — read the Feature; search for an existing `[QE]` epic.
2. **automation-coverage MCP** — `plan_qe_from_feature` (create) or `groom_qe_tickets` (update).
3. Atlassian MCP — `createJiraIssue` / `editJiraIssue` using each `jira` payload (markdown). Stories’ `parent` is the QE epic key.
4. Cluster/overlay tickets appear only when the Feature signals live stack, operator, or OCI.

Example: `Create the QE epic and layer tickets for RHDHPLAN-1742 (Boost workspace).`

## Pluggable layers

Builtins (from the RHDH test-placement ladder):

| id | Ladder | Playwright MCP? |
| --- | --- | --- |
| `unit` | L1 Jest/Vitest | no |
| `integration` | L2 `startTestBackend` | no |
| `component` | L3 RTL | no |
| `ui` | Plugin-source Playwright | **yes** |
| `smoke` | Overlay native smoke | no |
| `overlay-e2e` | Overlay cluster Playwright | **yes** |
| `cluster-free-e2e` | RHDH L4a | **yes** |
| `cluster-e2e` | RHDH L4b | **yes** |

Add or override layers in `.automation-coverage.yaml` (see `config/rhdh-forest.example.yaml`):

```yaml
disabledLayers: [cluster-e2e]
layers:
  - id: contract
    title: HTTP contract
    kind: custom
    cost: s
    fileKinds: [backend-router]
    testGlobs: ["**/*.contract.test.ts"]
    generator: Write a contract test against the public HTTP schema.
```

## Config lookup

1. `AUTOMATION_COVERAGE_CONFIG` (absolute path to a YAML file)
2. `.automation-coverage.yaml` walking up from `cwd`
3. `~/.config/automation-coverage/config.yaml`
4. Auto-detect: walk up from `cwd` until a parent directory contains sibling clones named `rhdh-plugins`, `community-plugins`, `rhdh`, `rhdh-plugin-export-overlays`, `lightspeed-playwright-e2e`, and/or `backstage`

Forest paths in YAML expand `~` and `${ENV_VAR}`. Copy `config/rhdh-forest.example.yaml` and substitute **`${FOREST_ROOT}`** (or export it) — that value is the parent directory that *contains* your clones, not `rhdh-plugins` itself.

| Token | Replace with |
| --- | --- |
| `${FOREST_ROOT}` | Absolute path of the folder that contains `rhdh-plugins`, `rhdh`, overlays, … |
| `<ABS_PATH_TO_THIS_CLONE>` | Absolute path of this `automation-coverage-mcp` checkout |
| `<plugin-workspace>` | Workspace folder name under `workspaces/` (e.g. `boost`) |

Omit forest entries you have not cloned. If `${FOREST_ROOT}` is left unexpanded, those rows are ignored and auto-detect is used.

## Run

```bash
cd <ABS_PATH_TO_THIS_CLONE>
npm install
npm test
npm start   # stdio MCP
```

Produce a coverage report in the plugin workspace before planning (`yarn test:all` / `backstage-cli repo test --coverage`). If no report is present, changed lines are treated as uncovered.

## Agent workflow

1. `generate_test_plan` with `cwd` set to the plugin workspace. Use `mode=workspace` when git diff is empty (existing plugin, not a feature branch).
2. Implement every `playwrightMcp: false` item by mirroring `template`
3. For `playwrightMcp: true` items, run `generate_playwright_brief` and drive Playwright MCP
4. Skip files in `skipped` (ignored wiring, already covered, non-source, already has a neighbor test)
