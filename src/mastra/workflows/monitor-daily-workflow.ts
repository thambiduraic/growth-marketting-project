import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

/**
 * Run daily (e.g. via cron) with campaignId and optional day number.
 * Uses Monitoring Agent to fetch KPIs and produce summary + optimization suggestions.
 */
const monitorDailyStep = createStep({
  id: 'monitor-daily',
  description: 'Fetch campaign KPIs and produce daily summary with optimization suggestions',
  inputSchema: z.object({
    campaignId: z.string().describe('Campaign ID to monitor'),
    day: z.number().optional().describe('Day number of the campaign (e.g. 1, 2, ...)'),
  }),
  outputSchema: z.object({
    summary: z.string(),
    suggestions: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('monitoringAgent');
    if (!agent) throw new Error('monitoringAgent not found');
    const prompt = `Daily check for campaign ${inputData.campaignId}${inputData.day != null ? ` (day ${inputData.day})` : ''}. Fetch current analytics, compare to target, and provide a brief summary plus 2-4 optimization suggestions.`;
    const res = await agent.generate([{ role: 'user', content: prompt }], { maxSteps: 5 });
    const text = res?.text ?? '';
    return {
      summary: text,
      suggestions: text,
    };
  },
});

export const monitorDailyWorkflow = createWorkflow({
  id: 'monitor-daily-workflow',
  description: 'Daily campaign performance check with optimization suggestions.',
  inputSchema: z.object({
    campaignId: z.string(),
    day: z.number().optional(),
  }),
  outputSchema: z.object({
    summary: z.string(),
    suggestions: z.string(),
  }),
})
  .then(monitorDailyStep)
  .commit();
