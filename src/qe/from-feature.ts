import { loadConfig } from '../config/load.js';
import { discoverPackages } from '../discovery/layout.js';
import { inventoryLayer } from '../inventory/tests.js';
import type { LayerDefinition } from '../types.js';
import {
  assignScenarioLayer,
  detectSurfaces,
  extractScenarios,
  extractTitle,
  layersForSurfaces,
} from './signals.js';
import {
  mergeGroomedDescription,
  matchLayerFromSummary,
  renderEpic,
  renderLayerTicket,
  type EpicDraft,
  type LayerTicketDraft,
} from './templates.js';
import { inferWorkspace } from './workspaces.js';

export interface ExistingQeIssue {
  key: string;
  summary: string;
  description?: string;
  issueType?: string;
}

export interface QePlanInput {
  feature: string;
  featureTitle?: string;
  featureKey?: string;
  workspace?: string;
  cwd?: string;
  projectKey?: string;
  existingIssues?: ExistingQeIssue[];
}

export interface JiraCreateHint {
  projectKey: string;
  issueType: 'Epic' | 'Story';
  summary: string;
  description: string;
  labels: string[];
  parent?: string;
  additional_fields: Record<string, unknown>;
}

export interface QePlan {
  workspace?: string;
  component?: string;
  surfaces: string[];
  principles: string[];
  epic: EpicDraft & { jira: JiraCreateHint };
  tickets: Array<LayerTicketDraft & { jira: JiraCreateHint }>;
  skippedLayers: Array<{ id: string; title: string; reason: string }>;
  updates: Array<{
    key: string;
    summary: string;
    description: string;
    layerId?: string;
    action: 'groom';
  }>;
  createOrder: string[];
}

function skippedLayers(all: LayerDefinition[], selected: LayerDefinition[]): QePlan['skippedLayers'] {
  const ids = new Set(selected.map(l => l.id));
  return all
    .filter(l => !ids.has(l.id))
    .map(l => ({
      id: l.id,
      title: l.title,
      reason: l.cluster
        ? 'Cluster/overlay live-stack not signaled in the Feature. Add only if mocks cannot catch the failure.'
        : 'Feature text did not signal this surface. Do not add it to raise coverage %.',
    }));
}

function excerpt(feature: string): string {
  return feature.trim().slice(0, 1500);
}

export function planQeFromFeature(input: QePlanInput): QePlan {
  const cwd = input.cwd;
  const config = loadConfig(cwd ?? process.cwd());
  const featureTitle = extractTitle(input.feature, input.featureTitle);
  const hint = inferWorkspace(`${featureTitle}\n${input.feature}`, input.workspace);
  const surfaces = detectSurfaces(`${featureTitle}\n${input.feature}`);
  const selected = layersForSurfaces(surfaces, config.layers);
  const scenarios = extractScenarios(input.feature);
  const skipped = skippedLayers(config.layers, selected);
  const projectKey = input.projectKey ?? 'RHIDP';

  let existingByLayer = new Map<string, string[]>();
  if (cwd && hint?.workspace) {
    try {
      const packages = discoverPackages(config.forest).filter(pkg => pkg.workspace === hint.workspace);
      for (const layer of selected) {
        const files = packages.flatMap(pkg => inventoryLayer(pkg, layer).map(t => t.file));
        existingByLayer.set(layer.id, [...new Set(files)]);
      }
    } catch {
      existingByLayer = new Map();
    }
  }

  const epicDraft = renderEpic({
    featureTitle,
    featureKey: input.featureKey,
    workspace: hint?.workspace,
    component: hint?.component,
    featureExcerpt: excerpt(input.feature),
    layers: selected,
    skipped,
    scenarios,
  });

  const tickets = selected.map(layer => {
    const layerScenarios = scenarios.filter(s => assignScenarioLayer(s, selected) === layer.id);
    return renderLayerTicket({
      layer,
      featureTitle,
      featureKey: input.featureKey,
      workspace: hint?.workspace,
      scenarios: layerScenarios,
      existingTests: existingByLayer.get(layer.id) ?? [],
    });
  });

  const epicJira: JiraCreateHint = {
    projectKey,
    issueType: 'Epic',
    summary: epicDraft.summary,
    description: epicDraft.description,
    labels: epicDraft.labels,
    parent: input.featureKey,
    additional_fields: {
      ...(hint?.component ? { components: [{ name: hint.component }] } : {}),
      'Epic Name': epicDraft.epicName,
    },
  };

  const ticketPayloads = tickets.map(ticket => ({
    ...ticket,
    jira: {
      projectKey,
      issueType: 'Story' as const,
      summary: ticket.summary,
      description: ticket.description,
      labels: ticket.labels,
      parent: undefined as string | undefined, // skill sets this to the created epic key
      additional_fields: {
        ...(hint?.component ? { components: [{ name: hint.component }] } : {}),
      },
    },
  }));

  const existing = input.existingIssues ?? [];
  const updates: QePlan['updates'] = [];
  if (existing.length > 0) {
    for (const issue of existing) {
      const isEpic = /epic/i.test(issue.issueType ?? '') || /^\[QE]/i.test(issue.summary);
      if (isEpic && !/\[L\d/i.test(issue.summary)) {
        updates.push({
          key: issue.key,
          summary: issue.summary,
          description: mergeGroomedDescription(issue.description ?? '', epicDraft.description),
          action: 'groom',
        });
        continue;
      }
      const layer = matchLayerFromSummary(issue.summary, selected);
      const ticket = layer ? tickets.find(t => t.layerId === layer.id) : undefined;
      if (!ticket) {
        updates.push({
          key: issue.key,
          summary: issue.summary,
          description: mergeGroomedDescription(
            issue.description ?? '',
            [
              '### Automation-coverage note',
              '',
              'Could not map this issue to a ladder layer from the Feature plan. Keep it if it is investigation/manual; otherwise retitle to `[L1]` / `[L2]` / `[L3]` / `[L4a]` / `[L4b]`.',
            ].join('\n'),
          ),
          action: 'groom',
        });
        continue;
      }
      updates.push({
        key: issue.key,
        summary: issue.summary.startsWith('[') ? issue.summary : ticket.summary,
        description: mergeGroomedDescription(issue.description ?? '', ticket.description),
        layerId: ticket.layerId,
        action: 'groom',
      });
    }
  }

  return {
    workspace: hint?.workspace,
    component: hint?.component,
    surfaces,
    principles: [
      'Cheapest layer that can catch the failure wins — do not duplicate the same assertion downstream.',
      'Justify each test by the failure it would catch, not by a coverage delta.',
    ],
    epic: { ...epicDraft, jira: epicJira },
    tickets: ticketPayloads,
    skippedLayers: skipped,
    updates,
    createOrder: ['epic', ...tickets.map(t => t.layerId)],
  };
}
