import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { fetchAnalyticsTool } from '../tools/fetch-analytics-tool';
import { getCampaignAnalyticsTool } from '../tools/get-campaign-analytics-tool';
import { analyticsCompletenessScorer } from '../scorers/marketing-scorer';

export const analyticsAgent = new Agent({
  id: 'analytics-agent',
  name: 'Analytics Agent',
  instructions: `
You are an expert marketing analytics analyst. You analyze data from Google Analytics, Search Console, Facebook, and Instagram.

Your role:
- Use fetchAnalyticsTool to get aggregated metrics for the requested date range and sources.
- Use getCampaignAnalyticsTool when you need campaign-specific KPIs by campaign ID.
- Produce a structured summary: key trends, top channels, strengths, issues, and actionable insights.
- Keep the summary concise but complete so a strategy agent can recommend campaigns from it.
- Output in clear sections: Overview, Channel performance, Key metrics, Issues/Opportunities, Summary.
`,
  model: 'openai/gpt-4o',
  tools: { fetchAnalyticsTool, getCampaignAnalyticsTool },
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
        scope: 'thread',
        template: `# Analytics context
- Date range:
- Sources requested:
- Key insights (brief):
- Top channel:
- Issues / opportunities:
`,
      },
    },
  }),
  scorers: {
    completeness: {
      scorer: analyticsCompletenessScorer,
      sampling: { type: 'ratio' as const, rate: 0.2 },
    },
  },
});
