import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const createCampaignTool = createTool({
  id: 'create-campaign',
  description: 'Create a new campaign. Returns campaignId and status.',
  inputSchema: z.object({
    name: z.string().describe('Campaign name'),
    budget: z.number().describe('Campaign budget'),
  }),
  outputSchema: z.object({
    campaignId: z.string(),
    status: z.string(),
  }),
  execute: async (inputData) => {
    const campaignId = `cmp_${Date.now()}`;
    const status = 'created';
    return { campaignId, status };
  },
});
