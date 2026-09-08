import type { LayerDefinition } from '../types.js';

export type FeatureSurface =
  | 'unit-logic'
  | 'backend'
  | 'react-ui'
  | 'react-page'
  | 'overlay'
  | 'cluster-free'
  | 'cluster';

const SURFACE_PATTERNS: Array<{ surface: FeatureSurface; re: RegExp }> = [
  {
    surface: 'cluster',
    re: /\b(openshift|ocp|operator|helm|idp|sso|keycloak|live llm|real token|real cluster|devcluster)\b/i,
  },
  {
    surface: 'cluster-free',
    re: /\b(cluster-free|plugin loads in (the )?real rhdh|product e2e|legacy-local)\b/i,
  },
  {
    surface: 'overlay',
    re: /\b(overlay|oci:\/\/|dynamic-plugins\.ya?ml|dynamic plugin artifact)\b/i,
  },
  {
    surface: 'backend',
    re: /\b(api|router|backend|auth policy|health|entity provider|ingestion|endpoint|http contract|startTestBackend)\b/i,
  },
  {
    surface: 'react-page',
    re: /\b(page|catalog|filter|search|navigate|user flow|user scenario|e2e|playwright|a11y|accessibility)\b/i,
  },
  {
    surface: 'react-ui',
    re: /\b(ui|react|modal|form|card|toolbar|sidebar|frontend|component|rtl)\b/i,
  },
  {
    surface: 'unit-logic',
    re: /\b(util|helper|hook|mapper|parser|client|pure function)\b/i,
  },
];

export function detectSurfaces(text: string): FeatureSurface[] {
  const found = new Set<FeatureSurface>();
  for (const { surface, re } of SURFACE_PATTERNS) {
    if (re.test(text)) {
      found.add(surface);
    }
  }
  if (found.size === 0) {
    found.add('react-page');
    found.add('unit-logic');
  }
  if (found.has('react-page')) {
    found.add('react-ui');
  }
  return [...found];
}

/** Map feature surfaces to layer ids using cheapest-wins (do not emit cluster unless signaled). */
export function layersForSurfaces(
  surfaces: FeatureSurface[],
  layers: LayerDefinition[],
): LayerDefinition[] {
  const wanted = new Set<string>();
  for (const surface of surfaces) {
    switch (surface) {
      case 'unit-logic':
        wanted.add('unit');
        break;
      case 'backend':
        wanted.add('unit');
        wanted.add('integration');
        break;
      case 'react-ui':
        wanted.add('component');
        break;
      case 'react-page':
        wanted.add('component');
        wanted.add('ui');
        break;
      case 'overlay':
        wanted.add('smoke');
        break;
      case 'cluster-free':
        wanted.add('cluster-free-e2e');
        break;
      case 'cluster':
        wanted.add('overlay-e2e');
        wanted.add('cluster-e2e');
        break;
      default:
        break;
    }
  }
  if (surfaces.includes('overlay') && surfaces.includes('cluster')) {
    wanted.add('overlay-e2e');
  }
  return layers.filter(layer => wanted.has(layer.id));
}

export function extractTitle(feature: string, featureTitle?: string): string {
  if (featureTitle?.trim()) {
    return featureTitle.trim().replace(/^#+\s*/, '');
  }
  const first = feature.split('\n').map(l => l.trim()).find(Boolean) ?? 'Untitled feature';
  return first.replace(/^#+\s*/, '').slice(0, 140);
}

export function extractScenarios(feature: string): string[] {
  const bullets = feature
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map(line => line.replace(/^[-*\d.]+\s+/, '').trim())
    .filter(line => line.length > 8);
  const unique = [...new Set(bullets)];
  return unique.slice(0, 24);
}

export function assignScenarioLayer(
  scenario: string,
  selected: LayerDefinition[],
): string {
  const ids = new Set(selected.map(l => l.id));
  if (/\b(operator|helm|ocp|openshift|idp|kafka cluster)\b/i.test(scenario) && ids.has('cluster-e2e')) {
    return 'cluster-e2e';
  }
  if (/\b(overlay|oci|live token|live llm)\b/i.test(scenario) && ids.has('overlay-e2e')) {
    return 'overlay-e2e';
  }
  if (/\b(auth policy|health|router|api\/|entity provider|ingestion)\b/i.test(scenario) && ids.has('integration')) {
    return 'integration';
  }
  if (/\b(util|helper|hook|mapper)\b/i.test(scenario) && ids.has('unit')) {
    return 'unit';
  }
  if (/\b(navigate|filter|search|sign-in|page|e2e|playwright|a11y)\b/i.test(scenario) && ids.has('ui')) {
    return 'ui';
  }
  if (ids.has('component')) {
    return 'component';
  }
  return selected[0]?.id ?? 'unit';
}
