/**
 * PromptEnhancer — Pre-generation prompt enrichment pipeline.
 *
 * Transforms raw user input through a multi-stage pipeline BEFORE it is
 * sent to any LLM. This improves code output accuracy and consistency.
 *
 * Pipeline stages:
 *   0. RAG Retrieval (async) — embed query + retrieve relevant code snippets
 *   1. Intent Detection      — classify what the user wants to do
 *   2. Constraint Injection  — prepend template + intent-aware instructions
 *   3. Code Context Summary  — inject compact current-file context
 *   4. Quality Constraints   — append universal output quality rules
 *
 * Entry points:
 *   enhanceWithRag() — async, runs all 5 stages including RAG retrieval
 *   enhance()        — sync, runs stages 1-4 only (backward compat / no workspaceId)
 *
 * Returns the enhanced prompt along with metadata (intent, notes) for logging.
 */

import { FileData } from '../types/workspace';
import { RagRetrievalService } from './ragRetrieval.service';

// ─── Intent Types ──────────────────────────────────────────────────────────────

export type PromptIntent =
  | 'create'    // Building something new from scratch
  | 'fix'       // Fixing a bug / broken behaviour
  | 'style'     // Visual / UI / CSS changes
  | 'refactor'  // Code quality improvements
  | 'explain'   // User wants an explanation
  | 'iterate'   // Modifying / extending existing code
  | 'unknown';

// ─── Intent Signal Map ─────────────────────────────────────────────────────────

const INTENT_SIGNALS: Record<PromptIntent, string[]> = {
  create: ['create', 'build', 'make', 'generate', 'develop', 'write', 'new', 'from scratch', 'implement', 'set up'],
  fix: ['fix', 'bug', 'error', 'broken', 'crash', 'not working', 'issue', 'problem', 'wrong', 'failed', 'exception', 'undefined', 'null'],
  style: ['style', 'color', 'design', 'layout', 'ui', 'responsive', 'dark mode', 'theme', 'font', 'spacing', 'padding', 'margin', 'animation', 'tailwind'],
  refactor: ['refactor', 'clean', 'optimize', 'restructure', 'reorganize', 'simplify', 'rewrite', 'improve code', 'better way'],
  explain: ['explain', 'what is', 'what does', 'how does', 'how do', 'why', 'describe', 'show me how', 'help me understand'],
  iterate: ['update', 'change', 'modify', 'edit', 'adjust', 'tweak', 'replace', 'rename', 'add', 'remove', 'delete', 'extend'],
  unknown: [],
};

// ─── Enhancement Result ────────────────────────────────────────────────────────

export interface EnhancementResult {
  /** The enriched prompt to send to the LLM */
  enhancedPrompt: string;
  /** Detected user intent */
  intent: PromptIntent;
  /** Notes about what enhancements were applied (for logging) */
  enhancementNotes: string[];
}

// ─── Core Enhancer ─────────────────────────────────────────────────────────────

export class PromptEnhancer {
  // ── Stage 0 + 1-4: Full RAG-enhanced pipeline (async) ────────────────────

  /**
   * Full 5-stage enhancement pipeline including RAG retrieval.
   * Use this as the primary entry point when workspaceId is available.
   *
   * Stage 0: Embed query + retrieve semantically relevant code from vector store
   * Stage 1: Intent detection
   * Stage 2: Constraint injection
   * Stage 3: Code context summary
   * Stage 4: Quality constraints
   */
  static async enhanceWithRag(
    rawPrompt: string,
    fileData: FileData | null,
    template: string = 'react',
    workspaceId?: string
  ): Promise<EnhancementResult> {
    const notes: string[] = [];

    // Stage 0: RAG Retrieval (async) — only if we have a workspace to search
    let ragBlock = '';
    if (workspaceId) {
      try {
        const snippets = await RagRetrievalService.retrieve(workspaceId, rawPrompt, 3);
        if (snippets.length > 0) {
          ragBlock = RagRetrievalService.formatForPrompt(snippets);
          notes.push(`rag_retrieved=${snippets.length}`);
        } else {
          notes.push('rag_no_results');
        }
      } catch {
        notes.push('rag_failed');
      }
    } else {
      notes.push('rag_skipped_no_workspace');
    }

    // Stages 1-4: run synchronous pipeline
    const syncResult = PromptEnhancer.enhance(rawPrompt, fileData, template);
    notes.push(...syncResult.enhancementNotes);

    // Assemble final prompt with RAG block at the top
    const parts: string[] = [];

    if (ragBlock) {
      parts.push(`[RELEVANT CODE CONTEXT — Retrieved via semantic search]\n${ragBlock}`);
    }

    parts.push(syncResult.enhancedPrompt);

    return {
      enhancedPrompt: parts.join('\n\n'),
      intent: syncResult.intent,
      enhancementNotes: notes,
    };
  }

  // ── Stages 1-4: Synchronous pipeline (no RAG) ─────────────────────────────

  /**
   * Run the synchronous enhancement pipeline (stages 1–4, no RAG).
   *
   * @param rawPrompt   The raw user message
   * @param fileData    Current workspace files (may be null for first generation)
   * @param template    The active framework template (react, vue, static, etc.)
   */
  static enhance(
    rawPrompt: string,
    fileData: FileData | null,
    template: string = 'react'
  ): EnhancementResult {
    const notes: string[] = [];

    // Stage 1: Intent Detection
    const intent = PromptEnhancer.detectIntent(rawPrompt);
    notes.push(`intent=${intent}`);

    // Stage 2: Constraint Injection
    const constraints = PromptEnhancer.buildConstraints(intent, template);
    if (constraints) notes.push('constraints_injected');

    // Stage 3: Code Context Summary
    const contextBlock = PromptEnhancer.buildContextSummary(fileData);
    if (contextBlock) notes.push('context_summary_injected');

    // Stage 4: Quality Constraints
    const qualityBlock = PromptEnhancer.buildQualityConstraints(intent);
    notes.push('quality_constraints_injected');

    // Assemble the enriched prompt
    const parts: string[] = [];

    if (constraints) {
      parts.push(`[TASK CONTEXT]\n${constraints}`);
    }

    if (contextBlock) {
      parts.push(`[CURRENT PROJECT CONTEXT]\n${contextBlock}`);
    }

    parts.push(`[USER REQUEST]\n${rawPrompt}`);
    parts.push(`[OUTPUT REQUIREMENTS]\n${qualityBlock}`);

    const enhancedPrompt = parts.join('\n\n');

    return { enhancedPrompt, intent, enhancementNotes: notes };
  }

  // ── Stage 1: Intent Detection ──────────────────────────────────────────────

  static detectIntent(prompt: string): PromptIntent {
    const lower = prompt.toLowerCase();

    for (const [intent, signals] of Object.entries(INTENT_SIGNALS) as [PromptIntent, string[]][]) {
      if (intent === 'unknown') continue;
      if (signals.some((sig) => lower.includes(sig))) {
        return intent;
      }
    }

    return 'unknown';
  }

  // ── Stage 2: Constraint Injection ─────────────────────────────────────────

  private static buildConstraints(intent: PromptIntent, template: string): string {
    const templateLabel = PromptEnhancer.templateLabel(template);
    const constraints: string[] = [];

    // Intent-specific guidance
    switch (intent) {
      case 'create':
        constraints.push(
          `You are creating a new ${templateLabel} application from scratch.`,
          'Focus on clean component architecture, proper separation of concerns, and reusability.',
          'Ensure the entry point is correctly defined and all imports are resolvable.'
        );
        break;

      case 'fix':
        constraints.push(
          'You are fixing a bug or broken behaviour in an existing application.',
          'Identify the root cause before patching — do not apply surface-level band-aid fixes.',
          'Do NOT break any existing functionality that is currently working.',
          'Preserve all existing component structure, state, and props unless they are the source of the bug.'
        );
        break;

      case 'style':
        constraints.push(
          'You are making visual/UI/styling changes to an existing application.',
          'Keep changes minimal and non-breaking — only modify styles, not logic.',
          'Use consistent Tailwind CSS utility classes. Avoid inline styles unless absolutely required.',
          'Ensure responsive design is preserved across all breakpoints.'
        );
        break;

      case 'refactor':
        constraints.push(
          'You are refactoring existing code for quality, clarity, or performance.',
          'CRITICAL: Preserve ALL existing functionality — refactoring must not change any user-visible behaviour.',
          'Improve readability, reduce duplication, and apply best practices for the framework.',
          'Do not add new features during a refactor.'
        );
        break;

      case 'explain':
        constraints.push(
          'The user wants an explanation, not a code change.',
          'Provide a clear, concise explanation in your assistantMessage field.',
          'If showing code examples, keep them short and illustrative.',
          'Return the existing files unchanged unless you need to add inline comments to explain.'
        );
        break;

      case 'iterate':
        constraints.push(
          `You are iterating on an existing ${templateLabel} application.`,
          'Build upon the existing code structure — do not rewrite from scratch unless explicitly asked.',
          'Keep all currently working features intact while adding or changing the requested feature.',
          'Match the existing code style, naming conventions, and patterns.'
        );
        break;

      default:
        constraints.push(
          `You are working on a ${templateLabel} application.`,
          'Follow best practices for this framework and maintain code quality.'
        );
    }

    return constraints.map((c, i) => `${i + 1}. ${c}`).join('\n');
  }

  // ── Stage 3: Code Context Summary ─────────────────────────────────────────

  private static buildContextSummary(fileData: FileData | null): string {
    if (!fileData || !fileData.files) return '';

    const files = fileData.files;
    const filePaths = Object.keys(files);
    if (filePaths.length === 0) return '';

    const lines: string[] = [];

    // List all current files
    lines.push(`The project currently has ${filePaths.length} file(s):`);
    filePaths.forEach((path) => {
      const lineCount = files[path].code?.split('\n').length ?? 0;
      lines.push(`  • ${path} (${lineCount} lines)`);
    });

    // Summarise the primary entry file if it exists
    const entryPaths = ['/App.js', '/App.jsx', '/src/App.vue', '/App.svelte', '/app/page.jsx', '/index.html', '/app.vue'];
    const entryPath = entryPaths.find((p) => files[p]);
    if (entryPath && files[entryPath]) {
      const code = files[entryPath].code ?? '';
      const componentNames = PromptEnhancer.extractComponentNames(code);
      if (componentNames.length > 0) {
        lines.push(`\nKey components in ${entryPath}: ${componentNames.slice(0, 6).join(', ')}`);
      }
      const importedFiles = filePaths
        .filter((p) => p !== entryPath && code.includes(p.replace(/^\//, '')))
        .slice(0, 5);
      if (importedFiles.length > 0) {
        lines.push(`Imported by entry: ${importedFiles.join(', ')}`);
      }
    }

    // Note current template
    if (fileData.template) {
      lines.push(`\nActive framework: ${fileData.template}`);
    }

    return lines.join('\n');
  }

  // ── Stage 4: Quality Constraints ──────────────────────────────────────────

  private static buildQualityConstraints(intent: PromptIntent): string {
    const universal = [
      'All imports must reference files included in your response or available packages.',
      'No placeholder comments like TODO, FIXME, or "add logic here" in the output code.',
      'Keep code production-quality, readable, and consistent with the existing style.',
      'The JSON response must be valid and complete — no truncation.',
    ];

    if (intent === 'fix') {
      universal.push('After fixing, verify the fix does not introduce new import errors or undefined references.');
    }

    if (intent === 'create' || intent === 'iterate') {
      universal.push('Ensure state management is handled correctly (no stale closures, no missing dependencies in useEffect).');
    }

    return universal.map((q, i) => `${i + 1}. ${q}`).join('\n');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static templateLabel(template: string): string {
    const labels: Record<string, string> = {
      react: 'React (Vite/functional components)',
      vue: 'Vue 3 (Composition API)',
      svelte: 'Svelte',
      nextjs: 'Next.js 14 (App Router)',
      angular: 'Angular 17 (standalone components)',
      nuxt: 'Nuxt 3',
      static: 'static HTML/CSS/JS',
    };
    return labels[template] ?? template;
  }

  private static extractComponentNames(code: string): string[] {
    const names: string[] = [];

    // Match: export default function/const ComponentName
    const defaultExportMatch = code.match(/export\s+default\s+(?:function\s+)?([A-Z][a-zA-Z0-9]*)/g);
    if (defaultExportMatch) {
      defaultExportMatch.forEach((m) => {
        const name = m.match(/([A-Z][a-zA-Z0-9]*)$/)?.[1];
        if (name) names.push(name);
      });
    }

    // Match: const/function ComponentName = / function ComponentName(
    const namedMatches = code.matchAll(/(?:const|function)\s+([A-Z][a-zA-Z0-9]*)\s*[=(]/g);
    for (const m of namedMatches) {
      if (m[1] && !names.includes(m[1])) names.push(m[1]);
    }

    return [...new Set(names)].slice(0, 8);
  }
}
