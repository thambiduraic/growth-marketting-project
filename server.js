import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const mcpServer = new McpServer({
  name: "marketing-agent-server",
  version: "1.0.0",
});

// Helpers for get_campaign_analytics: deterministic hash and realistic KPI simulation
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i) | 0;
  return Math.abs(h);
}

function simulateCampaignKPIs(campaignId) {
  const seed = simpleHash(campaignId);
  const r = (min, max) => min + (seed % (max - min + 1));
  const rf = (min, max) => min + (seed % 10000) / 10000 * (max - min);

  const impressions = r(5000, 450000);
  const targetCTR = Number((rf(0.02, 0.06)).toFixed(4));
  const ctr = Number((targetCTR * rf(0.6, 1.4)).toFixed(4));
  const clicks = Math.round(impressions * ctr);
  const conversionRate = rf(0.02, 0.08);
  const conversions = Math.round(clicks * conversionRate);
  const cpc = Number((rf(0.35, 2.5)).toFixed(2));
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
    period: "last_30_days",
  };
}

const CAMPAIGN_ID_SCHEMA = z
  .string()
  .min(1, "Campaign ID is required")
  .max(128, "Campaign ID too long")
  .regex(/^[a-zA-Z0-9_-]+$/, "Campaign ID must be alphanumeric, hyphens or underscores only");

// 1. get_campaign_analytics(campaignId: string) -> structured KPI object
mcpServer.registerTool(
  "get_campaign_analytics",
  {
    description: "Get analytics for a campaign by ID. Returns ctr, conversions, targetCTR, impressions, clicks, spend, and related KPIs as structured JSON.",
    inputSchema: {
      campaignId: CAMPAIGN_ID_SCHEMA.describe("Campaign ID (alphanumeric, 1–128 chars)"),
    },
  },
  async ({ campaignId }) => {
    const parsed = CAMPAIGN_ID_SCHEMA.safeParse(campaignId);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join("; ");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "invalid_campaign_id",
              message,
            }),
          },
        ],
        isError: true,
      };
    }

    const id = parsed.data.trim();
    const data = simulateCampaignKPIs(id);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            data,
          }, null, 0),
        },
      ],
    };
  }
);

// 2. compare_kpi(currentCTR: number, targetCTR: number) -> status
mcpServer.registerTool(
  "compare_kpi",
  {
    description: "Compare current CTR to target CTR. Returns status: above_target or below_target.",
    inputSchema: {
      currentCTR: z.number().describe("Current CTR"),
      targetCTR: z.number().describe("Target CTR"),
    },
  },
  async ({ currentCTR, targetCTR }) => {
    const status = currentCTR >= targetCTR ? "above_target" : "below_target";
    return {
      content: [{ type: "text", text: JSON.stringify({ status }) }],
    };
  }
);

// 3. recommend_campaign(analyticsSummary: string) -> 3 ideas (2 for 7 days, 1 for 14 days)
mcpServer.registerTool(
  "recommend_campaign",
  {
    description:
      "Recommend campaign ideas from an analytics summary. Returns 3 ideas: 2 for 7 days, 1 for 14 days.",
    inputSchema: {
      analyticsSummary: z.string().describe("Summary of campaign analytics"),
    },
  },
  async ({ analyticsSummary }) => {
    // Mock: replace with real recommendation logic
    const ideas = [
      { durationDays: 7, idea: "Scale top-performing ad sets by 20% and A/B test new creatives." },
      { durationDays: 7, idea: "Run a retargeting campaign for cart abandoners with a limited-time offer." },
      { durationDays: 14, idea: "Launch a full-funnel campaign with awareness, consideration, and conversion objectives." },
    ];
    return {
      content: [{ type: "text", text: JSON.stringify({ ideas }) }],
    };
  }
);

// 4. create_campaign(name: string, budget: number) -> campaignId, status
mcpServer.registerTool(
  "create_campaign",
  {
    description: "Create a new campaign. Returns campaignId and status.",
    inputSchema: {
      name: z.string().describe("Campaign name"),
      budget: z.number().describe("Campaign budget"),
    },
  },
  async ({ name, budget }) => {
    // Mock: replace with real campaign creation
    const campaignId = `cmp_${Date.now()}`;
    const status = "created";
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ campaignId, status }),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
