import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Mock aggregate analytics for GA, Search Console, Facebook, Instagram.
 * Replace with real API calls (GA4, GSC, Meta Marketing API) when integrating.
 */
export const fetchAnalyticsTool = createTool({
  id: 'fetch-analytics',
  description:
    'Fetch aggregated analytics for a date range from Google Analytics, Search Console, Facebook, and Instagram. Returns raw metrics per source.',
  inputSchema: z.object({
    dateRange: z.string().describe('e.g. last_30_days, last_7_days'),
    sources: z.array(z.enum(['ga', 'gsc', 'facebook', 'instagram'])).describe('Which sources to fetch'),
  }),
  outputSchema: z.object({
    dateRange: z.string(),
    ga: z
      .object({
        users: z.number(),
        sessions: z.number(),
        bounceRate: z.number(),
        avgSessionDuration: z.number(),
      })
      .optional(),
    gsc: z
      .object({
        clicks: z.number(),
        impressions: z.number(),
        ctr: z.number(),
        position: z.number(),
      })
      .optional(),
    facebook: z
      .object({
        reach: z.number(),
        impressions: z.number(),
        clicks: z.number(),
        ctr: z.number(),
        spend: z.number(),
      })
      .optional(),
    instagram: z
      .object({
        reach: z.number(),
        impressions: z.number(),
        engagement: z.number(),
        profileVisits: z.number(),
      })
      .optional(),
  }),
  execute: async (inputData) => {
    const result: {
      dateRange: string;
      ga?: { users: number; sessions: number; bounceRate: number; avgSessionDuration: number };
      gsc?: { clicks: number; impressions: number; ctr: number; position: number };
      facebook?: { reach: number; impressions: number; clicks: number; ctr: number; spend: number };
      instagram?: { reach: number; impressions: number; engagement: number; profileVisits: number };
    } = { dateRange: inputData.dateRange };
    if (inputData.sources.includes('ga')) {
      result.ga = {
        users: 12500,
        sessions: 18200,
        bounceRate: 0.42,
        avgSessionDuration: 145,
      };
    }
    if (inputData.sources.includes('gsc')) {
      result.gsc = {
        clicks: 3200,
        impressions: 89000,
        ctr: 0.036,
        position: 12.4,
      };
    }
    if (inputData.sources.includes('facebook')) {
      result.facebook = {
        reach: 45000,
        impressions: 78000,
        clicks: 2100,
        ctr: 0.027,
        spend: 850,
      };
    }
    if (inputData.sources.includes('instagram')) {
      result.instagram = {
        reach: 62000,
        impressions: 95000,
        engagement: 4200,
        profileVisits: 1800,
      };
    }
    return result;
  },
});
