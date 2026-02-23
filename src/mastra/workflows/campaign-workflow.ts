import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { recommendCampaignTool } from '../tools/recommend-campaign-tool';
import { createCampaignTool } from '../tools/create-campaign-tool';

const campaignIdeaSchema = z.object({
  durationDays: z.number(),
  idea: z.string(),
});

const workflowInputSchema = z.object({
  dateRange: z.string().describe('e.g. last_30_days'),
  sources: z.array(z.enum(['ga', 'gsc', 'facebook', 'instagram'])),
  campaignName: z.string().optional(),
  budget: z.number().optional(),
});

const stateSchema = z.object({
  analyticsSummary: z.string().optional(),
  campaignName: z.string().optional(),
  budget: z.number().optional(),
  selectedIdea: campaignIdeaSchema.optional(),
  plan: z.string().optional(),
  campaignId: z.string().optional(),
});

const analyzeStep = createStep({
  id: 'analyze-analytics',
  description: 'Fetch and analyze analytics from requested sources',
  inputSchema: workflowInputSchema,
  outputSchema: z.object({ summary: z.string() }),
  stateSchema,
  execute: async ({ inputData, mastra, setState }) => {
    if (inputData.campaignName != null) setState({ campaignName: inputData.campaignName });
    if (inputData.budget != null) setState({ budget: inputData.budget });
    const agent = mastra?.getAgent('analyticsAgent');
    if (!agent) throw new Error('analyticsAgent not found');
    const messages = [
      {
        role: 'user' as const,
        content: `Analyze analytics for date range: ${inputData.dateRange}, sources: ${inputData.sources.join(', ')}. Use fetchAnalyticsTool first, then produce a structured summary.`,
      },
    ];
    const res = await agent.generate(messages, { maxSteps: 5 });
    const summary = res?.text ?? '';
    setState({ analyticsSummary: summary });
    return { summary };
  },
});

const recommendStep = createStep({
  id: 'recommend-campaigns',
  description: 'Recommend 3 campaign ideas (2x7d, 1x14d)',
  inputSchema: z.object({ summary: z.string() }),
  outputSchema: z.object({
    ideas: z.array(campaignIdeaSchema),
  }),
  execute: async ({ inputData }) => {
    const result = await recommendCampaignTool.execute({
      analyticsSummary: inputData.summary,
    });
    return { ideas: result.ideas };
  },
});

const userSelectStep = createStep({
  id: 'user-select-campaign',
  description: 'Wait for user to select a campaign',
  inputSchema: z.object({ ideas: z.array(campaignIdeaSchema) }),
  outputSchema: z.object({
    selectedIndex: z.number(),
    selectedIdea: campaignIdeaSchema,
  }),
  resumeSchema: z.object({ selectedIndex: z.number() }),
  suspendSchema: z.object({
    reason: z.string(),
    ideas: z.array(campaignIdeaSchema),
  }),
  stateSchema,
  execute: async ({ inputData, resumeData, suspend, setState }) => {
    const selected = resumeData?.selectedIndex;
    if (selected === undefined) {
      return await suspend({
        reason: 'Please select a campaign (0, 1, or 2).',
        ideas: inputData.ideas,
      });
    }
    const selectedIdea = inputData.ideas[selected];
    setState({ selectedIdea });
    return {
      selectedIndex: selected,
      selectedIdea,
    };
  },
});

const createPlanStep = createStep({
  id: 'create-detailed-plan',
  description: 'Create a detailed execution plan for the selected campaign',
  inputSchema: z.object({
    selectedIndex: z.number(),
    selectedIdea: campaignIdeaSchema,
  }),
  outputSchema: z.object({ plan: z.string() }),
  stateSchema,
  execute: async ({ inputData, mastra, setState }) => {
    const agent = mastra?.getAgent('planningAgent');
    if (!agent) throw new Error('planningAgent not found');
    const prompt = `Create a detailed execution plan for this campaign idea: ${JSON.stringify(inputData.selectedIdea, null, 2)}. Include objectives, audience, creatives, schedule, budget allocation, and success metrics in markdown.`;
    const res = await agent.generate([{ role: 'user', content: prompt }]);
    const plan = res?.text ?? '';
    setState({ plan });
    return { plan };
  },
});

const userApproveStep = createStep({
  id: 'user-approve-plan',
  description: 'Wait for user to approve the plan',
  inputSchema: z.object({ plan: z.string() }),
  outputSchema: z.object({ approved: z.literal(true) }),
  resumeSchema: z.object({ approved: z.boolean() }),
  suspendSchema: z.object({ reason: z.string(), plan: z.string() }),
  execute: async ({ inputData, resumeData, suspend, bail }) => {
    const approved = resumeData?.approved;
    if (approved === false) {
      return bail({ reason: 'User rejected the plan.' });
    }
    if (approved !== true) {
      return await suspend({
        reason: 'Please review and approve or reject the plan.',
        plan: inputData.plan,
      });
    }
    return { approved: true as const };
  },
});

const executeStep = createStep({
  id: 'execute-campaign',
  description: 'Create the campaign',
  inputSchema: z.object({ approved: z.literal(true) }),
  outputSchema: z.object({ campaignId: z.string(), status: z.string() }),
  stateSchema,
  execute: async ({ state, setState }) => {
    const name = state.campaignName ?? `Campaign ${Date.now()}`;
    const budget = state.budget ?? 500;
    const result = await createCampaignTool.execute({ name, budget });
    setState({ campaignId: result.campaignId });
    return { campaignId: result.campaignId, status: result.status };
  },
});

export const campaignWorkflow = createWorkflow({
  id: 'campaign-workflow',
  description: 'Analyze analytics, recommend campaigns, get user selection and plan approval, then execute.',
  inputSchema: workflowInputSchema,
  outputSchema: z.object({
    campaignId: z.string().optional(),
    status: z.string(),
  }),
  stateSchema,
})
  .then(analyzeStep)
  .then(recommendStep)
  .then(userSelectStep)
  .then(createPlanStep)
  .then(userApproveStep)
  .then(executeStep)
  .commit();
