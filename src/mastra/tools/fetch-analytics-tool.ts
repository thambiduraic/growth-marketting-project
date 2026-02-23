import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { readFileSync } from 'fs';
import path from 'path';

// Resolve data from project root (npm run dev / mastra dev run from repo root).
const DATA_ROOT = path.join(process.cwd(), 'src', 'mastra', 'data');

function dateRangeToFilename(dateRange: string): string {
  const normalized = dateRange.toLowerCase().replace(/\s+/g, '_').trim();
  if (normalized === 'last_7_days') return 'last-7-days.json';
  if (normalized === 'last_30_days') return 'last-30-days.json';
  return 'last-30-days.json';
}

function loadJson<T>(dir: string, filename: string): T | null {
  try {
    const filePath = path.join(DATA_ROOT, dir, filename);
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// GSC: searchAnalytics
const gscRowSchema = z.object({
  page: z.string(),
  query: z.string(),
  clicks: z.number(),
  impressions: z.number(),
  ctr: z.number(),
  position: z.number(),
  device: z.string(),
});
const gscSchema = z.object({
  searchAnalytics: z.object({
    overall: z.object({
      averageCTR: z.number(),
      totalClicks: z.number(),
      averagePosition: z.number(),
      totalImpressions: z.number(),
    }),
    devices: z.array(
      z.object({
        device: z.string(),
        clicks: z.number(),
        impressions: z.number(),
        ctr: z.number(),
        position: z.number(),
      })
    ),
    topPages: z.array(gscRowSchema),
    topQueries: z.array(gscRowSchema),
  }),
});

// GA: webAnalytics
const gaSchema = z.object({
  webAnalytics: z.object({
    visitors: z.object({
      visitors: z.number(),
      prevVisitors: z.number(),
      percentageChange: z.number(),
    }),
    pageViews: z.object({
      pageViews: z.number(),
      prevPageViews: z.number(),
      percentageChange: z.number(),
    }),
    conversionRate: z.object({
      totalVisitors: z.number(),
      totalConversions: z.number(),
      conversionRatePercentage: z.number(),
    }),
    pagePaths: z.array(
      z.object({
        pagePath: z.string(),
        newUsers: z.number(),
        pageViews: z.number(),
        prevNewUsers: z.number(),
        prevPageViews: z.number(),
        pageViewsPercentageChange: z.number(),
      })
    ),
    trafficSources: z.array(
      z.object({
        source: z.string(),
        newUsers: z.number(),
        totalUsers: z.number(),
      })
    ),
    visitorsByRegions: z.array(
      z.object({
        city: z.string(),
        region: z.string(),
        newUsers: z.number(),
        totalUsers: z.number(),
      })
    ),
  }),
});

// Facebook: facebookPageAnalytics
const metricValueSchema = z.object({
  value: z.number(),
  percentageChange: z.number(),
});
const facebookSchema = z.object({
  facebookPageAnalytics: z.object({
    pageId: z.string(),
    pageName: z.string(),
    username: z.string(),
    period: z.string(),
    dataTimestamp: z.string(),
    fanCount: metricValueSchema,
    pageFans: metricValueSchema,
    pageFanAdds: metricValueSchema,
    followersCount: metricValueSchema,
    pageViewsTotal: metricValueSchema,
    pageImpressions: metricValueSchema,
    pageDailyFollows: metricValueSchema,
    pageTotalActions: metricValueSchema,
    pageImpressionsPaid: metricValueSchema,
    pagePostEngagements: metricValueSchema,
    pageImpressionsViral: metricValueSchema,
    pagePostsImpressions: metricValueSchema,
  }),
});

// Instagram: instagramBusinessAnalytics
const instagramSchema = z.object({
  instagramBusinessAnalytics: z.object({
    period: z.string(),
    dataTimestamp: z.string(),
    accounts: z.array(
      z.object({
        username: z.string(),
        instagramUserId: z.string(),
        mediaCount: metricValueSchema,
        followsCount: metricValueSchema,
        followersCount: metricValueSchema,
        mediaTypeMetrics: z.record(z.string(), metricValueSchema).optional(),
      })
    ),
  }),
});

// Output: we return the inner payload (searchAnalytics, webAnalytics, etc.) so the agent sees the same shape as the JSON files.
const gscOutputSchema = z
  .object({
    overall: z.object({
      averageCTR: z.number(),
      totalClicks: z.number(),
      averagePosition: z.number(),
      totalImpressions: z.number(),
    }),
    devices: z.array(z.any()),
    topPages: z.array(z.any()),
    topQueries: z.array(z.any()),
  })
  .optional();
const gaOutputSchema = z
  .object({
    visitors: z.any(),
    pageViews: z.any(),
    conversionRate: z.any(),
    pagePaths: z.array(z.any()),
    trafficSources: z.array(z.any()),
    visitorsByRegions: z.array(z.any()),
  })
  .optional();
const facebookOutputSchema = z.any().optional();
const instagramOutputSchema = z.any().optional();

/**
 * Fetches real analytics from stored JSON (GSC, GA, Facebook, Instagram).
 * Data is loaded from src/mastra/data/<source>/last-7-days.json or last-30-days.json.
 */
export const fetchAnalyticsTool = createTool({
  id: 'fetch-analytics',
  description:
    'Fetch aggregated analytics for a date range from Google Analytics, Search Console, Facebook, and Instagram. Returns raw metrics per source.',
  inputSchema: z.object({
    dateRange: z.string().describe('e.g. last_30_days, last_7_days'),
    sources: z
      .array(z.enum(['ga', 'gsc', 'facebook', 'instagram']))
      .describe('Which sources to fetch'),
  }),
  outputSchema: z.object({
    dateRange: z.string(),
    ga: gaOutputSchema,
    gsc: gscOutputSchema,
    facebook: facebookOutputSchema,
    instagram: instagramOutputSchema,
  }),
  execute: async (inputData) => {
    const filename = dateRangeToFilename(inputData.dateRange);
    const result: {
      dateRange: string;
      ga?: z.infer<typeof gaOutputSchema>;
      gsc?: z.infer<typeof gscOutputSchema>;
      facebook?: z.infer<typeof facebookOutputSchema>;
      instagram?: z.infer<typeof instagramOutputSchema>;
    } = { dateRange: inputData.dateRange };

    if (inputData.sources.includes('gsc')) {
      const data = loadJson<z.infer<typeof gscSchema>>(
        'google-search-console',
        filename
      );
      if (data?.searchAnalytics) {
        result.gsc = {
          overall: data.searchAnalytics.overall,
          devices: data.searchAnalytics.devices,
          topPages: data.searchAnalytics.topPages,
          topQueries: data.searchAnalytics.topQueries,
        };
      }
    }

    if (inputData.sources.includes('ga')) {
      const data = loadJson<z.infer<typeof gaSchema>>(
        'google-analytics',
        filename
      );
      if (data?.webAnalytics) {
        result.ga = data.webAnalytics;
      }
    }

    if (inputData.sources.includes('facebook')) {
      const data = loadJson<z.infer<typeof facebookSchema>>(
        'facebook-page',
        filename
      );
      if (data?.facebookPageAnalytics) {
        result.facebook = data.facebookPageAnalytics;
      }
    }

    if (inputData.sources.includes('instagram')) {
      const data = loadJson<z.infer<typeof instagramSchema>>(
        'instagram-business',
        filename
      );
      if (data?.instagramBusinessAnalytics) {
        result.instagram = data.instagramBusinessAnalytics;
      }
    }

    return result;
  },
});
