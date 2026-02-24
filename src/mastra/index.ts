import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
import { campaignWorkflow } from './workflows/campaign-workflow';
import { monitorDailyWorkflow } from './workflows/monitor-daily-workflow';
import { analyticsAgent } from './agents/analytics-agent';
import { strategyAgent } from './agents/strategy-agent';
import { planningAgent } from './agents/planning-agent';
import { monitoringAgent } from './agents/monitoring-agent';
import {
  analyticsCompletenessScorer,
  strategyCampaignFormatScorer,
  planStructureScorer,
  monitoringRelevancyScorer,
} from './scorers/marketing-scorer';

export const mastra = new Mastra({
  workflows: { campaignWorkflow, monitorDailyWorkflow },
  agents: {
    analyticsAgent,
    strategyAgent,
    planningAgent,
    monitoringAgent,
  },
  scorers: {
    analyticsCompletenessScorer,
    strategyCampaignFormatScorer,
    planStructureScorer,
    monitoringRelevancyScorer,
  },
  storage: new LibSQLStore({
    id: "mastra-storage",
    // stores observability, scores, ... into persistent file storage
    url: "file:./mastra.db",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new DefaultExporter(), // Persists traces to storage for Mastra Studio
          new CloudExporter(), // Sends traces to Mastra Cloud (if MASTRA_CLOUD_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});
