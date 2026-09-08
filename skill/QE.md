---
name: qe-feature-tickets
description: >-
  Create or groom RHIDP QE epics and cheapest-layer stories from a product
  Feature using the automation-coverage MCP, then Atlassian MCP to write Jira.
  Use when asked to create a QE epic, groom QE tickets, split a Feature into
  L1–L4b test tickets, or turn RHDHPLAN/RHIDP Feature text into QE work.
---

# Feature → QE tickets

Planner is **automation-coverage** (`plan_qe_from_feature` / `groom_qe_tickets`). Jira writes go through **Atlassian MCP**. This MCP does not call Jira itself.

## Steps

1. `getAccessibleAtlassianResources` — cache `cloudId`.
2. If the user gave a Feature key (`RHDHPLAN-…` / `RHIDP-…`): `getJiraIssue` with `view=evidence`. Feature text = summary + description + AC.
3. Search existing QE work: `parent = <featureKey> AND summary ~ "QE"`. Then children of any `[QE]` epic (`parent = <epicKey>`).
4. **Create** (no QE epic):
   - `plan_qe_from_feature` with `feature`, `featureKey`, `workspace`, `cwd` if known.
   - `createJiraIssue` Epic from `epic.jira` (`parent` = Feature key, `issueType` Epic, markdown description).
   - For each `tickets[]`: `createJiraIssue` Story with `parent` = **new epic key** and that ticket’s `jira` payload.
5. **Groom** (epic/children exist):
   - `groom_qe_tickets` with the same Feature plus `existingIssues: [{key, summary, description, issueType}]`.
   - `editJiraIssue` each `updates[]` row (`summary` + `description`).
6. Do **not** add cluster/overlay stories unless the plan included those layers. Cheapest layer wins — do not copy L3 assertions into L4a.
7. Comment on the Feature with created/groomed keys.

`projectKey` defaults to `RHIDP`. Child summaries look like `[L1] …`, `[L3] …`, `[L4a] …` (same as RHIDP-16047).
