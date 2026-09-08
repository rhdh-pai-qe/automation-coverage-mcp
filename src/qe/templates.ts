import type { LayerDefinition } from '../types.js';
import { PLAN_PRINCIPLES } from '../config/load.js';

export interface LayerTicketDraft {
  layerId: string;
  ladder: string;
  summary: string;
  description: string;
  labels: string[];
  issueType: 'Story';
  scenarios: string[];
  existingTests: string[];
  skipReason?: string;
}

export interface EpicDraft {
  summary: string;
  description: string;
  labels: string[];
  issueType: 'Epic';
  epicName: string;
}

export function layerSummary(layer: LayerDefinition, featureTitle: string): string {
  const short = featureTitle.replace(/^\[QE]\s*/i, '').slice(0, 80);
  return `[${layer.ladder}] ${layer.title.split('(')[0].trim()} — ${short}`;
}

export function epicSummary(featureTitle: string, workspace?: string): string {
  const plugin = workspace ? `[${workspace}] ` : '';
  const short = featureTitle.replace(/^\[QE]\s*/i, '').slice(0, 90);
  return `[QE] ${plugin}${short}`.replace(/\s+/g, ' ').trim();
}

export function renderEpic(input: {
  featureTitle: string;
  featureKey?: string;
  workspace?: string;
  component?: string;
  featureExcerpt: string;
  layers: LayerDefinition[];
  skipped: Array<{ id: string; reason: string }>;
  scenarios: string[];
}): EpicDraft {
  const summary = epicSummary(input.featureTitle, input.workspace);
  const layerRows = input.layers
    .map(
      layer =>
        `| \`${layer.ladder}\` ${layer.id} | ${layer.title} | ${layer.cost}${layer.cluster ? ', cluster' : ''} | ${layer.playwrightMcp ? 'Playwright MCP' : 'Jest / RTL'} |`,
    )
    .join('\n');
  const skipRows =
    input.skipped.length === 0
      ? '_None — every signaled surface has a ticket._'
      : input.skipped.map(s => `* \`${s.id}\` — ${s.reason}`).join('\n');
  const scenarios =
    input.scenarios.length === 0
      ? '* (none extracted — copy acceptance criteria from the Feature)'
      : input.scenarios.map(s => `* ${s}`).join('\n');

  const description = [
    '# EPIC Goal',
    '',
    `QE automation for **${input.featureTitle}** at the **cheapest layer that can catch each failure**. Do not duplicate the same assertion downstream.`,
    '',
    '## Background / Feature origin',
    '',
    input.featureKey
      ? `Parent Feature: [${input.featureKey}](https://redhat.atlassian.net/browse/${input.featureKey})`
      : 'Parent Feature: (link the RHDHPLAN / RHIDP Feature)',
    input.workspace ? `Plugin workspace: \`workspaces/${input.workspace}\`` : '',
    input.component ? `Jira Component: ${input.component}` : '',
    '',
    '## Why is this important?',
    '',
    'Placing tests at L4b/overlay Playwright when L1–L3 can catch the bug wastes CI time and still ships widget/layout escapes. This epic splits work by the RHDH test-placement ladder.',
    '',
    '## Layer plan',
    '',
    '| Ladder | Layer | Cost | How |',
    '| --- | --- | --- | --- |',
    layerRows || '| — | (no layers selected) | — | — |',
    '',
    '### Not this epic',
    '',
    skipRows,
    '',
    '## User scenarios (from the Feature)',
    '',
    scenarios,
    '',
    '## Scope boundary',
    '',
    ...PLAN_PRINCIPLES.map(p => `* ${p}`),
    '* Implementing product code is owned by the Eng epic, not these QE tickets.',
    '',
    '## Acceptance criteria',
    '',
    ...input.layers.map(
      layer =>
        `- [ ] QE — ${layer.ladder} \`${layer.id}\` story is done (tests fail if the named regression is introduced)`,
    ),
    '- [ ] QE — no child story duplicates an assertion already owned by a cheaper layer',
    '',
    '## Feature excerpt',
    '',
    input.featureExcerpt.slice(0, 1500),
  ]
    .filter(line => line !== undefined)
    .join('\n');

  return {
    summary,
    description,
    labels: ['qe', input.workspace].filter((x): x is string => Boolean(x)),
    issueType: 'Epic',
    epicName: summary.slice(0, 240),
  };
}

export function renderLayerTicket(input: {
  layer: LayerDefinition;
  featureTitle: string;
  featureKey?: string;
  workspace?: string;
  scenarios: string[];
  existingTests: string[];
}): LayerTicketDraft {
  const summary = layerSummary(input.layer, input.featureTitle);
  const loc = input.layer.locate.neighbor
    ? `Colocate next to source as \`${input.layer.locate.naming ?? '{basename}.test.ts'}\``
    : `Directory \`${input.layer.locate.directory ?? 'e2e-tests'}\` as \`${input.layer.locate.naming ?? '{feature}.test.ts'}\``;
  const scenarios =
    input.scenarios.length === 0
      ? '* Cover the Feature acceptance criteria that this layer can catch.'
      : input.scenarios.map(s => `* ${s}`).join('\n');
  const existing =
    input.existingTests.length === 0
      ? '_No neighbor tests inventoried (workspace not scanned or none exist). Mirror a sibling in the same package._'
      : input.existingTests
          .slice(0, 8)
          .map(f => `* \`${f}\``)
          .join('\n');

  const description = [
    `### Layer`,
    '',
    `**${input.layer.ladder} — ${input.layer.title}**`,
    '',
    input.layer.description,
    '',
    '### Failure to catch',
    '',
    `This story is done only if a regression in the Feature would fail **this** layer — not because coverage % moved.`,
    input.layer.playwrightMcp
      ? 'UI: explore with Playwright MCP first (`browser_navigate` → `browser_snapshot` → `browser_generate_locator` → verify). Do not write the spec from the scenario paragraph alone.'
      : 'Mirror a neighboring test; copy imports from the template. Do not invent `@backstage/test-utils` paths.',
    '',
    '### In scope',
    '',
    scenarios,
    '',
    `* ${loc}`,
    input.layer.runCommand ? `* Run: \`${input.layer.runCommand}\`` : '',
    '',
    '### Out of scope',
    '',
    '* Do not repeat assertions owned by a cheaper layer on this epic.',
    input.layer.cluster
      ? '* Only cover behavior mocks cannot observe (live token, IdP, operator, OCI load).'
      : '* Cluster / overlay Playwright is not this ticket unless this layer is L4b.',
    input.layer.id !== 'ui' && input.layer.id !== 'cluster-e2e' && input.layer.id !== 'overlay-e2e'
      ? '* Do not add plugin Playwright or cluster e2e here.'
      : '',
    '',
    '### Existing tests to mirror',
    '',
    existing,
    '',
    '### Acceptance criteria',
    '',
    '- [ ] Tests fail if the named Feature regression is introduced',
    '- [ ] Neighbor / workspace template imports are mirrored',
    input.layer.runCommand ? `- [ ] \`${input.layer.runCommand}\` is green for the new files` : '- [ ] Package test command is green for the new files',
    '- [ ] Same assertion is not duplicated on a more expensive child of this epic',
    '',
    '### Feature origin',
    '',
    input.featureKey
      ? `[${input.featureKey}](https://redhat.atlassian.net/browse/${input.featureKey}) — ${input.featureTitle}`
      : input.featureTitle,
  ]
    .filter(line => line !== '')
    .join('\n');

  return {
    layerId: input.layer.id,
    ladder: input.layer.ladder,
    summary,
    description,
    labels: ['qe', input.layer.id, input.workspace].filter((x): x is string => Boolean(x)),
    issueType: 'Story',
    scenarios: input.scenarios,
    existingTests: input.existingTests,
  };
}

const GROOM_MARKER = '<!-- automation-coverage-layer-plan -->';

export function mergeGroomedDescription(current: string, section: string): string {
  const start = current.indexOf(GROOM_MARKER);
  if (start >= 0) {
    const end = current.indexOf(GROOM_MARKER, start + GROOM_MARKER.length);
    const before = current.slice(0, start).trimEnd();
    const after = end >= 0 ? current.slice(end + GROOM_MARKER.length).trimStart() : '';
    return [before, '', GROOM_MARKER, '', section.trim(), '', GROOM_MARKER, after ? `\n${after}` : '']
      .join('\n')
      .trim();
  }
  return `${current.trim()}\n\n${GROOM_MARKER}\n\n${section.trim()}\n\n${GROOM_MARKER}\n`;
}

export function matchLayerFromSummary(summary: string, layers: LayerDefinition[]): LayerDefinition | undefined {
  const ladder = summary.match(/\[(L1|L2|L3|L4a|L4b|smoke)(?:\/[^\]]+)?\]/i)?.[1];
  if (ladder) {
    const lower = summary.toLowerCase();
    if (ladder.toLowerCase() === 'l4b') {
      if (/overlay/.test(lower)) {
        return layers.find(l => l.id === 'overlay-e2e');
      }
      if (/cluster|manual|kafka|ocp|operator/.test(lower)) {
        return layers.find(l => l.id === 'cluster-e2e');
      }
    }
    const byLadder = layers.find(l => l.ladder.toLowerCase() === ladder.toLowerCase());
    if (byLadder) {
      return byLadder;
    }
  }
  const lower = summary.toLowerCase();
  return layers.find(
    l =>
      lower.includes(l.id) ||
      lower.includes(l.title.split('(')[0].trim().toLowerCase()),
  );
}
