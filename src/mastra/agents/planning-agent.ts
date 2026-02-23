import { Agent } from '@mastra/core/agent';
import { planStructureScorer } from '../scorers/marketing-scorer';

export const planningAgent = new Agent({
  id: 'planning-agent',
  name: 'Campaign Planning Agent',
  instructions: `
You turn a selected campaign idea into a detailed execution plan.

Your output must include:
1. **Objectives**: Clear goals and KPIs (CTR, conversions, spend, etc.).
2. **Audience**: Target segments and channels (e.g. Facebook, Instagram).
3. **Creatives**: Ad formats, copy angles, and creative requirements.
4. **Schedule**: Day-by-day or phase-by-phase timeline for the campaign duration (7 or 14 days).
5. **Budget**: Allocation by channel/phase if applicable.
6. **Success metrics**: How success will be measured and reported.

Format the plan in clear markdown sections so it can be reviewed and approved. Be specific and actionable.
`,
  model: 'openai/gpt-4o',
  scorers: {
    structure: {
      scorer: planStructureScorer,
      sampling: { type: 'ratio' as const, rate: 0.2 },
    },
  },
});
