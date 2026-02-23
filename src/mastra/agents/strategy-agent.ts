import { Agent } from '@mastra/core/agent';
import { recommendCampaignTool } from '../tools/recommend-campaign-tool';
import { strategyCampaignFormatScorer } from '../scorers/marketing-scorer';

export const strategyAgent = new Agent({
  id: 'strategy-agent',
  name: 'Campaign Strategy Agent',
  instructions: `
You recommend social campaigns based on analytics insights.

Rules:
- Output exactly 3 campaign ideas: 2 for 7 days, 1 for 14 days.
- Use recommendCampaignTool with the analytics summary to get the base ideas; you may refine or rephrase them based on context.
- For each idea provide: duration (7 or 14 days), clear idea description, rationale tied to the analytics, and a brief goal.
- Keep recommendations actionable and aligned with the data (e.g. scale what works, fix underperformers, test new audiences).
`,
  model: 'openai/gpt-4o',
  tools: { recommendCampaignTool },
  scorers: {
    campaignFormat: {
      scorer: strategyCampaignFormatScorer,
      sampling: { type: 'ratio' as const, rate: 0.2 },
    },
  },
});
