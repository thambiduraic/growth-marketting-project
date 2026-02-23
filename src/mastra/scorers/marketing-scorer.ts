import { z } from 'zod';
import { createCompletenessScorer } from '@mastra/evals/scorers/prebuilt';
import {
  getAssistantMessageFromRunOutput,
  getUserMessageFromRunInput,
} from '@mastra/evals/scorers/utils';
import { createScorer } from '@mastra/core/evals';

/** Analytics Agent: completeness of the analytics summary */
export const analyticsCompletenessScorer = createCompletenessScorer();

/** Strategy Agent: checks that output references 3 ideas and correct durations (2x7d, 1x14d) */
export const strategyCampaignFormatScorer = createScorer({
  id: 'strategy-campaign-format-scorer',
  name: 'Strategy Campaign Format',
  description: 'Checks that strategy output has exactly 3 campaign ideas (2 for 7 days, 1 for 14 days)',
  type: 'agent',
  judge: {
    model: 'openai/gpt-4o',
    instructions:
      'You evaluate whether a campaign strategy response contains exactly 3 campaign ideas, with 2 ideas for 7 days and 1 idea for 14 days. Return only the structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const userText = getUserMessageFromRunInput(run.input) || '';
    const assistantText = getAssistantMessageFromRunOutput(run.output) || '';
    return { userText, assistantText };
  })
  .analyze({
    description: 'Detect number of ideas and durations mentioned',
    outputSchema: z.object({
      hasThreeIdeas: z.boolean(),
      twoSevenDay: z.boolean(),
      oneFourteenDay: z.boolean(),
      confidence: z.number().min(0).max(1).default(1),
      explanation: z.string().default(''),
    }),
    createPrompt: ({ results }) => `
      User (analytics context): """${results.preprocessStepResult.userText}"""
      Assistant (strategy response): """${results.preprocessStepResult.assistantText}"""
      Does the assistant recommend exactly 3 campaign ideas, with 2 for 7 days and 1 for 14 days?
      Return JSON: { "hasThreeIdeas": boolean, "twoSevenDay": boolean, "oneFourteenDay": boolean, "confidence": number 0-1, "explanation": string }
    `,
  })
  .generateScore(({ results }) => {
    const r = (results as { analyzeStepResult?: { hasThreeIdeas?: boolean; twoSevenDay?: boolean; oneFourteenDay?: boolean; confidence?: number } })?.analyzeStepResult;
    if (!r) return 0;
    const ok = r.hasThreeIdeas && r.twoSevenDay && r.oneFourteenDay;
    return ok ? Math.max(0, Math.min(1, 0.7 + 0.3 * (r.confidence ?? 1))) : 0;
  })
  .generateReason(({ results, score }) => {
    const r = (results as { analyzeStepResult?: { explanation?: string } })?.analyzeStepResult;
    return `Strategy format: score=${score}. ${r?.explanation ?? ''}`;
  });

/** Planning Agent: checks for required sections (objectives, audience, creatives, schedule, KPIs) */
export const planStructureScorer = createScorer({
  id: 'plan-structure-scorer',
  name: 'Plan Structure',
  description: 'Checks that the plan includes required sections: objectives, audience, creatives, schedule, success metrics',
  type: 'agent',
  judge: {
    model: 'openai/gpt-4o',
    instructions:
      'You evaluate whether a campaign plan includes: objectives/KPIs, audience, creatives, schedule/timeline, and success metrics. Return only the structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const assistantText = getAssistantMessageFromRunOutput(run.output) || '';
    return { assistantText };
  })
  .analyze({
    description: 'Detect presence of required plan sections',
    outputSchema: z.object({
      hasObjectives: z.boolean(),
      hasAudience: z.boolean(),
      hasCreatives: z.boolean(),
      hasSchedule: z.boolean(),
      hasMetrics: z.boolean(),
      confidence: z.number().min(0).max(1).default(1),
      explanation: z.string().default(''),
    }),
    createPrompt: ({ results }) => `
      Plan text: """${results.preprocessStepResult.assistantText}"""
      Does it include: objectives/goals/KPIs, audience/targeting, creatives/ad format, schedule/timeline, success metrics?
      Return JSON: { "hasObjectives": boolean, "hasAudience": boolean, "hasCreatives": boolean, "hasSchedule": boolean, "hasMetrics": boolean, "confidence": number 0-1, "explanation": string }
    `,
  })
  .generateScore(({ results }) => {
    const r = (results as { analyzeStepResult?: { hasObjectives?: boolean; hasAudience?: boolean; hasCreatives?: boolean; hasSchedule?: boolean; hasMetrics?: boolean; confidence?: number } })?.analyzeStepResult;
    if (!r) return 0;
    const count = [r.hasObjectives, r.hasAudience, r.hasCreatives, r.hasSchedule, r.hasMetrics].filter(Boolean).length;
    return (count / 5) * (0.8 + 0.2 * (r.confidence ?? 1));
  })
  .generateReason(({ results, score }) => {
    const r = (results as { analyzeStepResult?: { explanation?: string } })?.analyzeStepResult;
    return `Plan structure: score=${score}. ${r?.explanation ?? ''}`;
  });

/** Monitoring Agent: relevancy of suggestions to the campaign/KPIs context */
export const monitoringRelevancyScorer = createScorer({
  id: 'monitoring-relevancy-scorer',
  name: 'Monitoring Relevancy',
  description: 'Evaluates whether optimization suggestions are relevant to the campaign KPIs and context',
  type: 'agent',
  judge: {
    model: 'openai/gpt-4o',
    instructions:
      "You evaluate whether the assistant's daily summary and optimization suggestions are relevant to the campaign and the KPIs mentioned. Return only the structured JSON matching the provided schema.",
  },
})
  .preprocess(({ run }) => {
    const userText = getUserMessageFromRunInput(run.input) || '';
    const assistantText = getAssistantMessageFromRunOutput(run.output) || '';
    return { userText, assistantText };
  })
  .analyze({
    description: 'Relevancy of suggestions to context',
    outputSchema: z.object({
      relevant: z.boolean(),
      confidence: z.number().min(0).max(1).default(1),
      explanation: z.string().default(''),
    }),
    createPrompt: ({ results }) => `
      User (campaign/monitoring request): """${results.preprocessStepResult.userText}"""
      Assistant (summary + suggestions): """${results.preprocessStepResult.assistantText}"""
      Are the suggestions relevant to the campaign and KPIs? Return JSON: { "relevant": boolean, "confidence": number 0-1, "explanation": string }
    `,
  })
  .generateScore(({ results }) => {
    const r = (results as { analyzeStepResult?: { relevant?: boolean; confidence?: number } })?.analyzeStepResult;
    if (!r) return 0;
    return r.relevant ? Math.max(0, Math.min(1, 0.7 + 0.3 * (r.confidence ?? 1))) : 0;
  })
  .generateReason(({ results, score }) => {
    const r = (results as { analyzeStepResult?: { explanation?: string } })?.analyzeStepResult;
    return `Monitoring relevancy: score=${score}. ${r?.explanation ?? ''}`;
  });

export const marketingScorers = {
  analyticsCompletenessScorer,
  strategyCampaignFormatScorer,
  planStructureScorer,
  monitoringRelevancyScorer,
};
