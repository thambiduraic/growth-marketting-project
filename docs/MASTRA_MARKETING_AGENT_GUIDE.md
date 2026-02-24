# Mastra Marketing Agentic AI – Guide & Workspace Analysis

This document explains how your marketing agent project maps to [Mastra](https://mastra.ai/docs) and how to use Mastra for your full use case, including the **monitor daily performance with optimization suggestions** workflow.

---

## 1. Workspace Analysis

### What You Have

| Component | Status | Location |
|----------|--------|----------|
| **Analytics analysis** | ✅ Implemented | `analyticsAgent` + `fetchAnalyticsTool` (GA, GSC, Facebook, Instagram) |
| **Recommend 3 campaigns (2×7d, 1×14d)** | ✅ Implemented | `strategyAgent` + `recommendCampaignTool` in `campaign-workflow` |
| **User selects campaign** | ✅ Implemented | `userSelectStep` with suspend/resume (human-in-the-loop) |
| **Create detailed plan** | ✅ Implemented | `planningAgent` in `createPlanStep` |
| **User approves plan** | ✅ Implemented | `userApproveStep` with suspend/resume + bail on reject |
| **Execute campaign** | ✅ Implemented | `executeStep` + `createCampaignTool` |
| **Monitor daily + optimization suggestions** | ⚠️ Present but minimal | `monitor-daily-workflow.ts` + `monitoringAgent` |

### “Monitor Daily Performance with Optimization Suggestions” – Status

The **monitor-daily-workflow** exists and is registered. It:

- Takes `campaignId` (and optional `day`).
- Calls the **Monitoring Agent**, which uses `getCampaignAnalyticsTool` and `compareKpiTool` to fetch KPIs and compare to target.
- Returns a single `summary`/`suggestions` string (same content twice).

So the workflow is **not missing**; it is **present** but the step currently returns one blob for both summary and suggestions. You may want to:

- **Structured output**: Have the monitoring agent (or a post-step) return separate `summary` and `suggestions` (e.g. list of 2–4 items).
- **Scheduling**: Run this workflow daily (e.g. cron or workflow runner like Inngest) for each active campaign.

The rest of this guide ties Mastra concepts to your use case and suggests concrete patterns.

---

## 2. How to Use Mastra for Your Marketing Agent (Based on Docs)

Mastra docs: [Overview](https://mastra.ai/docs), [Agents](https://mastra.ai/docs/agents/overview), [Workflows](https://mastra.ai/docs/workflows/overview), [Memory](https://mastra.ai/docs/memory/overview), [Human-in-the-loop](https://mastra.ai/docs/workflows/human-in-the-loop), [Observability](https://mastra.ai/docs/observability/overview), [Evals](https://mastra.ai/docs/evals/overview).

### Your Use Case (Recap)

1. Analyze analytics (GA, Search Console, Facebook, Instagram).
2. Recommend 3 social campaigns (2×7-day, 1×14-day).
3. User selects a campaign.
4. Create a detailed plan.
5. User approves the plan.
6. Execute the campaign.
7. **Monitor daily performance with optimization suggestions.**

---

## 3. Step-by-Step: Setting Up a Mastra Project (Before Coding)

1. **Create/verify project**  
   - Use `create mastra` CLI or manual install.  
   - Ensure `tsconfig`: `"module": "ES2022"`, `"moduleResolution": "bundler"`.

2. **Install deps**  
   - Core: `@mastra/core`.  
   - Optional: `@mastra/memory`, `@mastra/evals`, `@mastra/observability`, `@mastra/libsql` (or other storage).

3. **Configure storage**  
   - Required for observability and (optionally) memory.  
   - Example: LibSQL `file:./mastra.db` for local; use external DB for serverless.

4. **Configure observability (recommended)**  
   - `Observability` + `DefaultExporter` (and optionally `CloudExporter`) so you can trace workflows and agents in Studio/Cloud.

5. **Define agents, tools, workflows**  
   - One place (e.g. `src/mastra/index.ts`) to register workflows and agents with the single `Mastra` instance.

6. **Run and test**  
   - `npm run dev` → Mastra Studio (e.g. localhost:4111) to run workflows and inspect traces.

This matches what you already did; the only gap was making the **monitor-daily** workflow’s output explicitly “daily performance + optimization suggestions” (see section 7 and code below).

---

## 4. Defining Agents for Your Use Case

Mastra **agents** are for open-ended tasks: they use an LLM + tools and (optionally) memory. Use **workflows** for fixed sequences and human approvals.

| Your need | Mastra concept | Your implementation |
|----------|----------------|----------------------|
| Analyze analytics | **Agent** (data analysis) | `analyticsAgent` + `fetchAnalyticsTool`, `getCampaignAnalyticsTool` |
| Recommend campaigns | **Agent** (strategy) | `strategyAgent` + `recommendCampaignTool` |
| Create detailed plan | **Agent** (planning) | `planningAgent` (no tools; uses selected idea from workflow state) |
| Monitor + suggest optimizations | **Agent** (monitoring) | `monitoringAgent` + `getCampaignAnalyticsTool`, `compareKpiTool` |

- **Data analysis agent**: Input = date range + sources; output = structured summary. Tools = fetch analytics (and optionally campaign KPIs).  
- **Strategy agent**: Input = analytics summary; output = 3 ideas (2×7d, 1×14d). Tools = recommend-campaign.  
- **Planning agent**: Input = selected idea; output = markdown plan (objectives, audience, creatives, schedule, budget, metrics).  
- **Monitoring agent**: Input = campaign ID (+ optional day); output = daily summary + 2–4 optimization suggestions. Tools = get campaign analytics, compare KPI to target.

You already have this split; the monitoring agent’s **output** can be refined so the **workflow** exposes distinct `summary` and `suggestions` (see section 7).

---

## 5. Using Workflows to Orchestrate and Include Human Approvals

Use a **workflow** for the linear pipeline and **human-in-the-loop** for “user selects” and “user approves”.

- **createWorkflow** + **createStep**: define steps with `inputSchema` / `outputSchema`; chain with `.then()`; end with `.commit()`.
- **State**: use `stateSchema` and `setState` to pass analytics summary, selected idea, plan, campaignId across steps without wiring every step’s input/output.
- **Suspend for human input**: in a step, call `suspend({ reason, ... })` when you need the user to choose or approve; the run returns `status: 'suspended'` and `suspendPayload`.
- **Resume**: call `run.resume({ step: 'step-id', resumeData: { ... } })` with the user’s choice or approval.
- **Rejection**: use `bail({ reason })` when the user explicitly rejects (e.g. plan rejected); workflow finishes without error.

Your **campaign-workflow** already does: analyze → recommend → **user select** (suspend) → create plan → **user approve** (suspend/bail) → execute.  
**Monitor-daily-workflow** is a single automated step (no human in the loop); you run it daily per campaign (e.g. cron or Inngest).

---

## 6. How to Use Mastra Memory (Short-Term and Semantic)

From [Memory overview](https://mastra.ai/docs/memory/overview):

- **Message history**: recent messages in the current thread (short-term, for continuity).
- **Working memory**: structured, persistent data (e.g. user preferences, campaign goals, selected idea) per thread.
- **Semantic recall**: retrieve past messages by meaning (needs vector store + embeddings); good for “remember similar past analyses or plans”.
- **Observational memory**: replace long message history with a condensed observation log to keep context small.

For your marketing agent:

- **Short-term**: Message history is used automatically in each agent conversation (e.g. “last summary”, “last plan”) so the next turn stays coherent.
- **Working memory**: Use for “current campaign id”, “current plan”, “date range and sources” so agents don’t need to be re-told every time.
- **Semantic**: Store **analytics insights**, **approved plans**, and **daily performance summaries** in a thread (or a dedicated memory store) and use semantic recall so the strategy/planning/monitoring agents can reference “similar past campaigns” or “last week’s insights”.

You already use **working memory** on analytics and monitoring agents (templates in `memory.options.workingMemory`). To add semantic recall you’d add a vector store and enable `semanticRecall` in the Memory config for the relevant agents.

---

## 7. Modeling Inputs, Outputs, and Interactions

- **Campaign workflow**
  - **Input**: `dateRange`, `sources[]`, optional `campaignName`, `budget`.
  - **State**: `analyticsSummary`, `campaignName`, `budget`, `selectedIdea`, `plan`, `campaignId`.
  - **Output**: `campaignId?`, `status`.
  - **Interactions**: Analytics agent → strategy (via tool) → user (suspend: select index) → planning agent → user (suspend: approve/reject) → createCampaign tool.

- **Monitor-daily workflow**
  - **Input**: `campaignId`, optional `day`.
  - **Output**: `summary` (daily performance), `suggestions` (2–4 optimization items).
  - **Interactions**: Single step calls monitoring agent; agent uses getCampaignAnalytics + compareKpi and returns text; step can parse or structure that into `summary` and `suggestions`.

Structuring the monitoring step’s output (e.g. separate summary vs list of suggestions) improves clarity for downstream UIs or automation.

---

## 8. Tool Integrations (Analytics APIs)

Today you use:

- **fetchAnalyticsTool**: reads from local JSON under `src/mastra/data/` (GA, GSC, Facebook, Instagram) to simulate analytics.
- **getCampaignAnalyticsTool**: simulated campaign KPIs by campaign ID.
- **compareKpiTool**: compares current vs target CTR.
- **recommendCampaignTool**, **createCampaignTool**: campaign ideas and creation (simulated or API).

To plug real APIs:

- Add tools that call **Google Analytics**, **Search Console**, **Facebook Marketing API**, **Instagram Graph API** (with env-based credentials).
- Keep the same tool **input/output** schemas where possible so your agents and workflows don’t need to change; only the `execute` implementation changes from “read JSON” to “call API”.

---

## 9. Test, Observe, and Refine (Observability and Evals)

- **Observability**  
  - With `Observability` + `DefaultExporter` (and storage), Mastra records traces.  
  - In Studio you see workflow steps, agent tool calls, and model usage.  
  - Use this to debug why a step failed or why the monitoring agent didn’t return suggestions.

- **Evals (scorers)**  
  - You already have: `analyticsCompletenessScorer`, `strategyCampaignFormatScorer`, `planStructureScorer`, `monitoringRelevancyScorer`.  
  - They run as live evals (sampling on agents) and can be used in Studio to score traces.  
  - Use them to: ensure analytics summaries are complete, strategy has 3 ideas (2×7d, 1×14d), plans have the right sections, and monitoring suggestions are relevant.  
  - Refine prompts/tools based on low scores.

---

## 10. Code Examples (TypeScript) – Agent and Workflow Structure

### Example: Agent with tools and memory

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { myTool } from '../tools/my-tool';

export const myAgent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  instructions: 'You do X. Use myTool when...',
  model: 'openai/gpt-4o',
  tools: { myTool },
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
        scope: 'thread',
        template: '# Context\n- Key facts:\n',
      },
    },
  }),
});
```

### Example: Workflow with one step that calls an agent

```typescript
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const step1 = createStep({
  id: 'step-1',
  description: 'Run agent and return result',
  inputSchema: z.object({ campaignId: z.string() }),
  outputSchema: z.object({ summary: z.string(), suggestions: z.string() }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('monitoringAgent');
    if (!agent) throw new Error('monitoringAgent not found');
    const res = await agent.generate(
      [{ role: 'user', content: `Daily check for campaign ${inputData.campaignId}. Fetch KPIs, compare to target, then provide a brief summary and 2-4 optimization suggestions.` }],
      { maxSteps: 5 }
    );
    const text = res?.text ?? '';
    return { summary: text, suggestions: text };
  },
});

export const myWorkflow = createWorkflow({
  id: 'my-workflow',
  description: 'Daily monitoring with suggestions.',
  inputSchema: z.object({ campaignId: z.string() }),
  outputSchema: z.object({ summary: z.string(), suggestions: z.string() }),
})
  .then(step1)
  .commit();
```

### Example: Human-in-the-loop (suspend / resume / bail)

```typescript
const userApproveStep = createStep({
  id: 'user-approve',
  inputSchema: z.object({ plan: z.string() }),
  outputSchema: z.object({ approved: z.literal(true) }),
  resumeSchema: z.object({ approved: z.boolean() }),
  suspendSchema: z.object({ reason: z.string(), plan: z.string() }),
  execute: async ({ inputData, resumeData, suspend, bail }) => {
    if (resumeData?.approved === false) return bail({ reason: 'User rejected.' });
    if (resumeData?.approved !== true) {
      return await suspend({ reason: 'Approve or reject the plan.', plan: inputData.plan });
    }
    return { approved: true as const };
  },
});
```

---

## 11. Summary

- Your workspace already implements the full flow: analytics → recommend 3 campaigns → user select → plan → user approve → execute, plus a **monitor-daily-workflow** that uses the monitoring agent for daily performance and optimization suggestions.
- The “missing” part is only that the monitor workflow could expose **structured** `summary` and `suggestions` and be run on a schedule; the code change is small (see `monitor-daily-workflow.ts` enhancement below).
- Mastra fits your use case by: **agents** for analysis, strategy, planning, and monitoring; **workflows** for the pipeline and human-in-the-loop; **memory** for short-term and (optionally) semantic recall of insights/plans/performance; **tools** for analytics (and real API integration); **observability** and **evals** to test and refine.

For full docs and references, use [Mastra docs](https://mastra.ai/docs) and the [llms.txt index](https://mastra.ai/llms.txt).
