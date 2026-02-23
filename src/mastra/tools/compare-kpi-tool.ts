import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const compareKpiTool = createTool({
  id: 'compare-kpi',
  description: 'Compare current CTR to target CTR. Returns status: above_target or below_target.',
  inputSchema: z.object({
    currentCTR: z.number().describe('Current CTR'),
    targetCTR: z.number().describe('Target CTR'),
  }),
  outputSchema: z.object({
    status: z.enum(['above_target', 'below_target']),
  }),
  execute: async (inputData) => {
    const status = inputData.currentCTR >= inputData.targetCTR ? 'above_target' : 'below_target';
    return { status };
  },
});
