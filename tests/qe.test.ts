import { describe, expect, it } from 'vitest';
import { planQeFromFeature } from '../src/qe/from-feature.js';
import { mergeGroomedDescription, matchLayerFromSummary } from '../src/qe/templates.js';
import { BUILTIN_LAYERS } from '../src/layers/builtins.js';

const CATALOG_FEATURE = `
# AI Catalog table view and type filters

Users can browse AI assets, filter by type, search, and switch table view.

Acceptance criteria:
- Catalog page lists skills and agents from the catalog API
- Type filter keeps only matching cards and sets type in the URL
- Search sets q and hides non-matching cards
- GET /api/boost/health is unauthenticated
`;

describe('planQeFromFeature', () => {
  it('plans L1–L3 plus plugin Playwright for a catalog UI + health Feature, not cluster', () => {
    const plan = planQeFromFeature({
      feature: CATALOG_FEATURE,
      featureTitle: 'AI Catalog discovery',
      featureKey: 'RHDHPLAN-1742',
      workspace: 'boost',
    });
    const ids = plan.tickets.map(t => t.layerId);
    expect(ids).toEqual(expect.arrayContaining(['unit', 'integration', 'component', 'ui']));
    expect(ids).not.toContain('cluster-e2e');
    expect(ids).not.toContain('overlay-e2e');
    expect(plan.epic.jira.issueType).toBe('Epic');
    expect(plan.epic.jira.parent).toBe('RHDHPLAN-1742');
    expect(plan.epic.summary).toMatch(/^\[QE]/);
    expect(plan.tickets.every(t => t.jira.issueType === 'Story')).toBe(true);
    expect(plan.tickets.find(t => t.layerId === 'ui')?.summary).toMatch(/^\[L4a]/);
    expect(plan.component).toBe('Boost');
  });

  it('keeps cluster e2e only when the Feature signals OCP/operator', () => {
    const plan = planQeFromFeature({
      feature: 'Install the plugin via Helm on OpenShift and configure the IdP operator.',
      featureTitle: 'Helm install',
    });
    const ids = plan.tickets.map(t => t.layerId);
    expect(ids).toContain('cluster-e2e');
  });

  it('grooms existing [L3] stories without dropping prior text', () => {
    const plan = planQeFromFeature({
      feature: CATALOG_FEATURE,
      featureTitle: 'AI Catalog discovery',
      workspace: 'boost',
      existingIssues: [
        {
          key: 'RHIDP-1',
          summary: '[QE] Boost catalog',
          description: 'Old epic goal.',
          issueType: 'Epic',
        },
        {
          key: 'RHIDP-2',
          summary: '[L3] Frontend component tests for catalog',
          description: 'Keep this sentence.',
          issueType: 'Story',
        },
      ],
    });
    expect(plan.updates).toHaveLength(2);
    const story = plan.updates.find(u => u.key === 'RHIDP-2');
    expect(story?.description).toContain('Keep this sentence.');
    expect(story?.description).toContain('Failure to catch');
    expect(story?.description).toContain('automation-coverage-layer-plan');
  });
});

describe('templates', () => {
  it('matches ladder prefixes used on RHIDP QE stories', () => {
    expect(matchLayerFromSummary('[L1] Backend unit gaps', BUILTIN_LAYERS)?.id).toBe('unit');
    expect(matchLayerFromSummary('[L3] Frontend component tests', BUILTIN_LAYERS)?.id).toBe(
      'component',
    );
    expect(matchLayerFromSummary('[L4b/Manual] Optional Kafka e2e', BUILTIN_LAYERS)?.ladder).toBe(
      'L4b',
    );
  });

  it('is idempotent when grooming twice', () => {
    const once = mergeGroomedDescription('hello', '### Layer\nL3');
    const twice = mergeGroomedDescription(once, '### Layer\nL3 updated');
    expect(twice.match(/automation-coverage-layer-plan/g)?.length).toBe(2);
    expect(twice).toContain('L3 updated');
    expect(twice).not.toContain('L3\n');
  });
});
