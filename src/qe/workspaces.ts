export interface WorkspaceHint {
  workspace: string;
  component: string;
  aliases: string[];
}

/** Jira Component / feature-text aliases → rhdh-plugins workspace dir. */
export const WORKSPACE_HINTS: WorkspaceHint[] = [
  { workspace: 'adoption-insights', component: 'Adoption Insights', aliases: ['adoption insights'] },
  { workspace: 'bulk-import', component: 'Bulk Import', aliases: ['bulk import'] },
  { workspace: 'extensions', component: 'Extensions', aliases: [] },
  { workspace: 'homepage', component: 'Homepage', aliases: [] },
  { workspace: 'lightspeed', component: 'Lightspeed', aliases: ['intelligent assistant', 'intelligent-assistant'] },
  { workspace: 'intelligent-assistant', component: 'Lightspeed', aliases: ['lightspeed'] },
  { workspace: 'global-header', component: 'Global Header', aliases: ['global header'] },
  { workspace: 'quickstart', component: 'Quickstart', aliases: [] },
  { workspace: 'scorecard', component: 'Scorecard', aliases: [] },
  { workspace: 'orchestrator', component: 'Orchestrator', aliases: [] },
  { workspace: 'mcp-integrations', component: 'MCP', aliases: ['mcp'] },
  { workspace: 'boost', component: 'Boost', aliases: ['ai catalog', 'ai-catalog'] },
  { workspace: 'theme', component: 'Theme', aliases: [] },
  { workspace: 'dcm', component: 'DCM', aliases: [] },
];

export function inferWorkspace(text: string, explicit?: string): WorkspaceHint | undefined {
  if (explicit) {
    const key = explicit.toLowerCase().replace(/\s+/g, '-');
    return (
      WORKSPACE_HINTS.find(h => h.workspace === key) ?? {
        workspace: key,
        component: explicit,
        aliases: [],
      }
    );
  }
  const hay = text.toLowerCase();
  return WORKSPACE_HINTS.find(hint => {
    if (hay.includes(hint.workspace) || hay.includes(hint.component.toLowerCase())) {
      return true;
    }
    return hint.aliases.some(alias => hay.includes(alias));
  });
}
