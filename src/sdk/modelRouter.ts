/**
 * ModelRouter — Intelligent model selection for the KsCode AI website builder
 * and chat/conversation flows.
 *
 * Analyzes each incoming prompt along two dimensions:
 *   1. Task Type  — what the user wants to do (debug, feature, style, refactor, explain)
 *   2. Complexity — how hard the task is (scored 0–100 from multiple signals)
 *
 * Website builder (generateCodeStream) — stays on Gemini SDK:
 *   - Simple / fast tasks  → gemini-2.0-flash   (low latency, cost-efficient)
 *   - Standard/complex     → gemini-2.5-flash   (best reasoning)
 *
 * Chat/conversation flow (routeForChat) — also uses OpenRouter:
 *   - Very simple tasks    → openrouter / meta-llama/llama-3.2-3b-instruct:free  (zero cost)
 *   - Medium tasks         → openrouter / mistralai/mistral-7b-instruct:free     (free, quality)
 *   - Complex tasks        → gemini / gemini-2.5-flash                            (best quality)
 *
 * All decisions are returned with metadata for observability logging.
 */

import { FileData } from '../types/workspace';

// ─── Task Type ────────────────────────────────────────────────────────────────

export type TaskType =
  | 'debug'
  | 'feature'
  | 'styling'
  | 'refactor'
  | 'explain'
  | 'iterate'
  | 'general';

const TASK_SIGNALS: Record<TaskType, string[]> = {
  debug: ['fix', 'bug', 'error', 'broken', 'crash', 'issue', 'wrong', 'not working', 'exception', 'undefined', 'null', 'failed'],
  feature: ['add', 'create', 'build', 'make', 'implement', 'new', 'feature', 'generate', 'develop', 'write'],
  styling: ['style', 'color', 'design', 'layout', 'ui', 'responsive', 'css', 'tailwind', 'theme', 'font', 'dark mode', 'spacing', 'padding', 'margin'],
  refactor: ['refactor', 'clean', 'optimize', 'restructure', 'reorganize', 'simplify', 'performance', 'improve code', 'rewrite'],
  explain: ['explain', 'what is', 'how does', 'why', 'describe', 'what does', 'show me how'],
  iterate: ['update', 'change', 'modify', 'edit', 'adjust', 'tweak', 'replace', 'rename'],
  general: [],
};

// ─── Complexity Signals ───────────────────────────────────────────────────────

const COMPLEXITY_KEYWORDS = [
  'algorithm', 'authentication', 'authorization', 'database', 'api',
  'state management', 'redux', 'context', 'websocket', 'real-time',
  'performance', 'cache', 'lazy load', 'infinite scroll', 'pagination',
  'form validation', 'drag and drop', 'animation', 'chart', 'graph',
  'multi-step', 'wizard', 'dashboard', 'admin', 'role', 'permission',
  'search', 'filter', 'sort', 'upload', 'file', 'payment', 'stripe',
];

const MULTI_STEP_PHRASES = [
  'and then', 'after that', 'also add', 'also make', 'and also',
  'additionally', 'furthermore', 'on top of that', 'plus', 'as well as',
];

// ─── Routing Decision ─────────────────────────────────────────────────────────

export interface RoutingDecision {
  /** Model identifier to use */
  model: string;
  /**
   * Provider key — present when the router picks a specific provider
   * (e.g. 'openrouter'). Undefined means use the default Gemini SDK path.
   */
  provider?: string;
  /** 0–100 complexity score */
  complexityScore: number;
  /** Detected task type */
  taskType: TaskType;
  /** Human-readable reason for the routing choice */
  reason: string;
}

// ─── Core Router ──────────────────────────────────────────────────────────────

export class ModelRouter {
  /**
   * Analyse the last user message + current file context and return
   * the optimal Gemini model variant to use for this generation.
   */
  static route(prompt: string, fileData?: FileData | null): RoutingDecision {
    const lower = prompt.toLowerCase();

    const taskType = ModelRouter.detectTaskType(lower);
    const complexityScore = ModelRouter.scoreComplexity(lower, fileData);

    return ModelRouter.selectModel(complexityScore, taskType);
  }

  // ── Task Type Detection ────────────────────────────────────────────────────

  private static detectTaskType(lowerPrompt: string): TaskType {
    for (const [type, signals] of Object.entries(TASK_SIGNALS) as [TaskType, string[]][]) {
      if (type === 'general') continue;
      if (signals.some((sig) => lowerPrompt.includes(sig))) {
        return type;
      }
    }
    return 'general';
  }

  // ── Complexity Scoring ────────────────────────────────────────────────────

  private static scoreComplexity(lowerPrompt: string, fileData?: FileData | null): number {
    let score = 0;

    // Signal 1: Prompt length (word count) — up to 25 pts
    const wordCount = lowerPrompt.split(/\s+/).filter(Boolean).length;
    if (wordCount > 100) score += 25;
    else if (wordCount > 50) score += 15;
    else if (wordCount > 20) score += 8;
    else score += 3;

    // Signal 2: Number of existing files in context — up to 20 pts
    const fileCount = fileData ? Object.keys(fileData.files || {}).length : 0;
    if (fileCount > 10) score += 20;
    else if (fileCount > 5) score += 12;
    else if (fileCount > 2) score += 6;
    else if (fileCount > 0) score += 3;

    // Signal 3: Total lines of existing code — up to 20 pts
    const totalLines = fileData
      ? Object.values(fileData.files || {}).reduce(
          (acc, f) => acc + (f.code?.split('\n').length ?? 0),
          0
        )
      : 0;
    if (totalLines > 500) score += 20;
    else if (totalLines > 200) score += 12;
    else if (totalLines > 50) score += 6;

    // Signal 4: Presence of complexity keywords — up to 20 pts
    const keywordHits = COMPLEXITY_KEYWORDS.filter((kw) => lowerPrompt.includes(kw)).length;
    score += Math.min(keywordHits * 5, 20);

    // Signal 5: Multi-step / compound instructions — up to 15 pts
    const multiStepHits = MULTI_STEP_PHRASES.filter((p) => lowerPrompt.includes(p)).length;
    score += Math.min(multiStepHits * 5, 15);

    return Math.min(score, 100);
  }

  // ── Model Selection (Website Builder — Gemini only) ───────────────────────

  private static selectModel(
    complexityScore: number,
    taskType: TaskType
  ): RoutingDecision {
    // Simple, isolated tasks — use fast model
    if (complexityScore < 30 && (taskType === 'debug' || taskType === 'styling' || taskType === 'explain')) {
      return {
        model: 'gemini-2.0-flash',
        complexityScore,
        taskType,
        reason: `Low complexity ${taskType} task (score ${complexityScore}) — using gemini-2.0-flash for speed`,
      };
    }

    // Light iterate / general with no existing context
    if (complexityScore < 25) {
      return {
        model: 'gemini-2.0-flash',
        complexityScore,
        taskType,
        reason: `Very low complexity (score ${complexityScore}) — using gemini-2.0-flash`,
      };
    }

    // Everything else — use the more capable model
    return {
      model: 'gemini-2.5-flash',
      complexityScore,
      taskType,
      reason: `Complexity score ${complexityScore} / task type "${taskType}" — using gemini-2.5-flash for quality`,
    };
  }

  // ── Chat / Conversation Routing (multi-provider via LLMWrapper) ────────────

  /**
   * Route a chat/conversation message to the optimal provider + model.
   * Uses free OpenRouter models for simple tasks to minimise cost.
   *
   * @returns RoutingDecision with `provider` set ('openrouter' | 'gemini')
   */
  static routeForChat(prompt: string): RoutingDecision {
    const lower = prompt.toLowerCase();
    const taskType = ModelRouter.detectTaskType(lower);
    const complexityScore = ModelRouter.scoreComplexity(lower, null);

    // Very simple prompts → free OpenRouter Llama (zero cost)
    if (complexityScore < 20) {
      return {
        model: 'meta-llama/llama-3.2-3b-instruct:free',
        provider: 'openrouter',
        complexityScore,
        taskType,
        reason: `Very simple prompt (score ${complexityScore}) → free Llama 3.2 3B via OpenRouter`,
      };
    }

    // Medium complexity → free Mistral 7B via OpenRouter
    if (complexityScore < 45) {
      return {
        model: 'mistralai/mistral-7b-instruct:free',
        provider: 'openrouter',
        complexityScore,
        taskType,
        reason: `Medium prompt (score ${complexityScore}) → free Mistral 7B via OpenRouter`,
      };
    }

    // Complex prompts → Gemini 2.5 Flash (best reasoning)
    return {
      model: 'gemini-2.5-flash',
      provider: 'gemini',
      complexityScore,
      taskType,
      reason: `Complex prompt (score ${complexityScore}) → Gemini 2.5 Flash`,
    };
  }
}
