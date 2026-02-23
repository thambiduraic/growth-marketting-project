import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function simulateCampaignKPIs(campaignId: string) {
  const seed = simpleHash(campaignId);
  const r = (min: number, max: number) => min + (seed % (max - min + 1));
  const rf = (min: number, max: number) => min + ((seed % 10000) / 10000) * (max - min);

  const impressions = r(5000, 450000);
  const targetCTR = Number(rf(0.02, 0.06).toFixed(4));
  const ctr = Number((targetCTR * rf(0.6, 1.4)).toFixed(4));
  const clicks = Math.round(impressions * ctr);
  const conversionRate = rf(0.02, 0.08);
  const conversions = Math.round(clicks * conversionRate);
  const cpc = Number(rf(0.35, 2.5).toFixed(2));
  const spend = Number((clicks * cpc).toFixed(2));

  return {
    campaignId,
    ctr,
    conversions,
    targetCTR,
    impressions,
    clicks,
    spend,
    conversionRate: Number(conversionRate.toFixed(4)),
    period: 'last_30_days',
  };
}

const campaignIdSchema = z
  .string()
  .min(1, 'Campaign ID is required')
  .max(128, 'Campaign ID too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Campaign ID must be alphanumeric, hyphens or underscores only');

const kpiOutputSchema = z.object({
  campaignId: z.string(),
  ctr: z.number(),
  conversions: z.number(),
  targetCTR: z.number(),
  impressions: z.number(),
  clicks: z.number(),
  spend: z.number(),
  conversionRate: z.number(),
  period: z.string(),
});

export const getCampaignAnalyticsTool = createTool({
  id: 'get-campaign-analytics',
  description:
    'Get analytics for a campaign by ID. Returns ctr, conversions, targetCTR, impressions, clicks, spend, and related KPIs.',
  inputSchema: z.object({
    campaignId: campaignIdSchema.describe('Campaign ID (alphanumeric, 1–128 chars)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: kpiOutputSchema.optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  }),
  execute: async (inputData) => {
    const parsed = campaignIdSchema.safeParse(inputData.campaignId);
    if (!parsed.success) {
      const message = parsed.error.issues.map((e) => e.message).join('; ');
      return { success: false, error: 'invalid_campaign_id', message };
    }
    const data = simulateCampaignKPIs(parsed.data.trim());
    return { success: true, data };
  },
});
