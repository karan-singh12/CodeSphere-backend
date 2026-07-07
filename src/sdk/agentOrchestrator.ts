/**
 * AgentOrchestrator — Central orchestration layer for the KsCode AI multi-agent system.
 *
 * This is the single decision point that sits in front of all AI generation flows.
 * Given a user prompt and the current workspace context, it decides:
 *
 *   1. Agent Mode — which execution strategy to use:
 *        • direct_generate  → single LLM call (fast, for most tasks)
 *        • agentic_improve  → Cline multi-step tool-calling loop (for complex refactors)
 *
 *   2. Model Selection — delegates to ModelRouter for optimal provider/model choice.
 *
 * Orchestration Decision Tree:
 *
 *   No existing files   ──────────────────────────────► direct_generate
 *   Agentic trigger keywords (refactor, restructure…) ► agentic_improve
 *   Complexity ≥ 70 + has existing files  ────────────► agentic_improve
 *   Task type = refactor + has existing files ─────────► agentic_improve
 *   Everything else  ──────────────────────────────────► direct_generate
 *
 * All decisions are logged to InferenceLogs via metadata in the SSE stream.
 */

import { ModelRouter, RoutingDecision, TaskType } from './modelRouter';
import { FileData } from '../types/workspace';

// ─── Agent Modes ──────────────────────────────────────────────────────────────

export type AgentMode =
  | 'direct_generate'   // Single LLM call, JSON output — fast and reliable
  | 'agentic_improve';  // Cline multi-step tool-calling loop — better for complex edits

// ─── Orchestrator Decision ────────────────────────────────────────────────────

export interface OrchestratorDecision {
  /** Which agent execution mode was selected */
  agentMode: AgentMode;
  /** Gemini model to use */
  model: string;
  /** 0–100 complexity score from ModelRouter */
  complexityScore: number;
  /** Detected task type */
  taskType: TaskType;
  /** Human-readable explanation of the routing decision */
  reason: string;
  /** Full routing decision from ModelRouter (for detailed logging) */
  routingDecision: RoutingDecision;
}

// ─── Keywords that trigger the agentic loop ──────────────────────────────────

const AGENTIC_TRIGGER_KEYWORDS = [
  'refactor the entire',
  'restructure',
  'reorganize',
  'rewrite the entire',
  'overhaul',
  'redesign everything',
  'migrate',
  'convert to',
  'move all',
  'split into',
  'break into',
  'extract all',
];

// ─── Core Orchestrator ────────────────────────────────────────────────────────

export class AgentOrchestrator {
  /**
   * Analyse the prompt and workspace context, then return the full
   * orchestration decision including agent mode and model selection.
   *
   * @param prompt    The latest user message (raw, pre-enhancement)
   * @param fileData  Current workspace files — null for first-time generation
   * @param forceMode Optional override to lock into a specific agent mode
   */
  static decide(
    prompt: string,
    fileData: FileData | null,
    forceMode?: AgentMode
  ): OrchestratorDecision {
    const routingDecision = ModelRouter.route(prompt, fileData);
    const { complexityScore, taskType } = routingDecision;

    // If caller explicitly forces a mode, respect it
    if (forceMode) {
      return {
        agentMode: forceMode,
        model: routingDecision.model,
        complexityScore,
        taskType,
        reason: `[forced] Agent mode locked to "${forceMode}"`,
        routingDecision,
      };
    }

    const agentMode = AgentOrchestrator.selectAgentMode(prompt, fileData, complexityScore, taskType);
    const reason = AgentOrchestrator.buildReason(agentMode, complexityScore, taskType);

    return { agentMode, model: routingDecision.model, complexityScore, taskType, reason, routingDecision };
  }

  // ── Agent Mode Selection ──────────────────────────────────────────────────

  private static selectAgentMode(
    prompt: string,
    fileData: FileData | null,
    complexityScore: number,
    taskType: TaskType
  ): AgentMode {
    const lower = prompt.toLowerCase();
    const fileCount = fileData ? Object.keys(fileData.files ?? {}).length : 0;
    const hasExistingFiles = fileCount > 0;

    // No files → always direct generation (building from scratch)
    if (!hasExistingFiles) {
      return 'direct_generate';
    }

    // Agentic trigger keywords → use multi-step tool-calling loop
    if (AGENTIC_TRIGGER_KEYWORDS.some((kw) => lower.includes(kw))) {
      return 'agentic_improve';
    }

    // High complexity on an existing, multi-file codebase → agentic loop
    if (complexityScore >= 70 && fileCount >= 3) {
      return 'agentic_improve';
    }

    // Explicit refactor task on existing code → agentic loop handles it better
    if (taskType === 'refactor' && hasExistingFiles) {
      return 'agentic_improve';
    }

    // Default: direct generation (fast, works for iterative feature adds + fixes)
    return 'direct_generate';
  }

  // ── Reason Builder ────────────────────────────────────────────────────────

  private static buildReason(
    agentMode: AgentMode,
    complexityScore: number,
    taskType: TaskType
  ): string {
    if (agentMode === 'agentic_improve') {
      return `Agentic loop selected — complexity ${complexityScore}, task "${taskType}" benefits from multi-step tool-calling`;
    }
    return `Direct generation selected — complexity ${complexityScore}, task "${taskType}"`;
  }
}
