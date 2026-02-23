import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const campaignIdeaSchema = z.object({
  durationDays: z.number(),
  idea: z.string(),
});

export const recommendCampaignTool = createTool({
  id: 'recommend-campaign',
  description:
    'Recommend campaign ideas from an analytics summary. Returns 3 ideas: 2 for 7 days, 1 for 14 days.',
  inputSchema: z.object({
    analyticsSummary: z.string().describe('Summary of campaign analytics'),
  }),
  outputSchema: z.object({
    ideas: z.array(campaignIdeaSchema),
  }),
  execute: async ({ analyticsSummary }) => {
    // Mock: replace with real recommendation logic / LLM later
    const ideas = [
      {
        durationDays: 7,
        idea: 'Scale top-performing ad sets by 20% and A/B test new creatives.',
      },
      {
        durationDays: 7,
        idea: 'Run a retargeting campaign for cart abandoners with a limited-time offer.',
      },
      {
        durationDays: 14,
        idea:
          'Launch a full-funnel campaign with awareness, consideration, and conversion objectives.',
      },
    ];
    return { ideas };
  },
});
