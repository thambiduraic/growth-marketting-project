import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

/**
 * Run daily (e.g. via cron) with campaignId and optional day number.
 * Uses Monitoring Agent to fetch KPIs and produce a daily performance summary
 * plus explicit optimization suggestions (2-4 actionable items).
 */
const monitorDailyStep = createStep({
  id: 'monitor-daily',
  description:
    'Fetch campaign KPIs, compare to target, and produce daily summary with 2-4 optimization suggestions',
  inputSchema: z.object({
    campaignId: z.string().describe('Campaign ID to monitor'),
    day: z.number().optional().describe('Day number of the campaign (e.g. 1, 2, ...)'),
  }),
  outputSchema: z.object({
    summary: z.string().describe('Daily performance summary: key metrics, trend vs target'),
    suggestions: z
      .string()
      .describe('2-4 concrete optimization suggestions (e.g. scale winners, pause underperformers)'),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('monitoringAgent');
    if (!agent) throw new Error('monitoringAgent not found');
    const dayContext =
      inputData.day != null ? ` (day ${inputData.day} of campaign)` : '';
    const prompt = `Daily performance check for campaign ${inputData.campaignId}${dayContext}.

1. Use getCampaignAnalyticsTool to fetch current KPIs (CTR, conversions, spend, etc.).
2. Use compareKpiTool to compare current CTR to target CTR.
3. In your response, provide exactly two parts in this format:

**Daily Summary:**
[A brief paragraph: key metrics, trend vs target, and whether the campaign is on track.]

**Optimization Suggestions:**
[2-4 numbered, actionable suggestions—e.g. scale winning ad sets, pause underperformers, adjust targeting, refresh creatives. Reference actual numbers.]`;

    const res = await agent.generate([{ role: 'user', content: prompt }], {
      maxSteps: 5,
    });
    const text = res?.text ?? '';

    // Parse into summary vs suggestions if the agent followed the format; otherwise keep both as full text
    const summaryMatch = text.match(/\*\*Daily Summary:\*\*\s*([\s\S]*?)(?=\*\*Optimization Suggestions:\*\*|$)/i);
    const suggestionsMatch = text.match(/\*\*Optimization Suggestions:\*\*\s*([\s\S]*?)$/i);
    const summary = summaryMatch?.[1]?.trim() || text;
    const suggestions = suggestionsMatch?.[1]?.trim() || text;

    return {
      summary,
      suggestions,
    };
  },
});

export const monitorDailyWorkflow = createWorkflow({
  id: 'monitor-daily-workflow',
  description:
    'Monitor daily campaign performance with optimization suggestions. Run per campaign (e.g. via cron or workflow runner).',
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
