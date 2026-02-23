import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { getCampaignAnalyticsTool } from '../tools/get-campaign-analytics-tool';
import { compareKpiTool } from '../tools/compare-kpi-tool';
import { monitoringRelevancyScorer } from '../scorers/marketing-scorer';

export const monitoringAgent = new Agent({
  id: 'monitoring-agent',
  name: 'Campaign Monitoring Agent',
  instructions: `
You monitor campaign performance and suggest optimizations.

Your role:
- Use getCampaignAnalyticsTool to fetch current KPIs for a campaign by ID.
- Use compareKpiTool to check if CTR (or other KPIs) are above or below target.
- Produce a daily summary: key metrics, trend vs target, and 2–4 concrete optimization suggestions (e.g. scale winning ad sets, pause underperformers, adjust targeting, refresh creatives).
- Keep suggestions actionable and specific. Reference the actual numbers in your summary.
`,
  model: 'openai/gpt-4o',
  tools: { getCampaignAnalyticsTool, compareKpiTool },
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
        scope: 'thread',
        template: `# Campaign monitoring log
- Campaign ID:
- Day/date:
- Key metrics (CTR, conversions, spend):
- vs target:
- Suggestions given:
`,
      },
    },
  }),
  scorers: {
    relevancy: {
      scorer: monitoringRelevancyScorer,
      sampling: { type: 'ratio' as const, rate: 0.2 },
    },
  },
});
