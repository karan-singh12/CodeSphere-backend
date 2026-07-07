/**
 * RagRetrievalService — Semantic code retrieval for the RAG pipeline.
 *
 * Implements the two halves of Retrieval-Augmented Generation:
 *
 *   INDEX  — After code is generated, embed each file and store the vector
 *            in the CodeSnippet table (Postgres via Prisma). Runs non-blocking.
 *
 *   RETRIEVE — At generation time, embed the user's prompt, compute cosine
 *              similarity against all stored snippet vectors for this workspace,
 *              and return the top-K most relevant code chunks.
 *
 * The retrieved snippets are injected into the PromptEnhancer as Stage 0,
 * before any other enhancement takes place.
 *
 * Storage: embeddings stored as JSON float arrays in Postgres — no pgvector
 *          extension required. Cosine similarity computed in Node.js.
 */

import prisma from '../config/prisma';
import { EmbeddingService } from './embedding.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RetrievedSnippet {
  filePath: string;
  content: string;
  similarity: number; // 0–1 cosine similarity score
}

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_FILES_TO_INDEX = 20;       // Index at most 20 files per workspace
const MIN_FILE_LENGTH = 30;          // Skip files shorter than 30 chars
const MAX_CONTENT_STORE_CHARS = 4000;// Store at most 4000 chars per snippet
const SIMILARITY_THRESHOLD = 0.3;   // Minimum similarity to include in results

// ─── Core Service ─────────────────────────────────────────────────────────────

export class RagRetrievalService {
  // ── INDEX: Store embeddings after code generation ─────────────────────────

  /**
   * Index all files from a workspace into the CodeSnippet vector store.
   * Safe to call fire-and-forget (catches all errors internally).
   *
   * @param workspaceId  The workspace to index
   * @param files        The generated file map (path → { code })
   */
  static async indexWorkspaceFiles(
    workspaceId: string,
    files: Record<string, { code: string }>
  ): Promise<void> {
    try {
      // Delete existing snippets for this workspace (full re-index)
      await prisma.codeSnippet.deleteMany({ where: { workspaceId } });

      const entries = Object.entries(files)
        .filter(([, { code }]) => code && code.length >= MIN_FILE_LENGTH)
        .slice(0, MAX_FILES_TO_INDEX);

      if (entries.length === 0) return;

      // Embed and store each file concurrently
      await Promise.all(
        entries.map(async ([filePath, { code }]) => {
          // Prefix the file path so the embedding captures file identity
          const textToEmbed = `File: ${filePath}\n\n${code}`;
          const embedding = await EmbeddingService.embed(textToEmbed);

          if (!embedding) return; // Skip if embedding failed (API error / missing key)

          await prisma.codeSnippet.create({
            data: {
              workspaceId,
              filePath,
              content: code.slice(0, MAX_CONTENT_STORE_CHARS),
              embedding: embedding as any, // stored as JSON float[]
            },
          });
        })
      );

      console.log(`[RagRetrieval] Indexed ${entries.length} files for workspace ${workspaceId}`);
    } catch (err: any) {
      // Always non-fatal — RAG is an enhancement, not a critical path
      console.error('[RagRetrieval] Indexing error (non-fatal):', err?.message ?? err);
    }
  }

  // ── RETRIEVE: Find relevant snippets for a user prompt ───────────────────

  /**
   * Retrieve the top-K most semantically relevant code snippets for a prompt.
   *
   * @param workspaceId  The workspace to search in
   * @param queryPrompt  The user's raw prompt
   * @param topK         Number of results to return (default: 3)
   * @returns            Sorted array of relevant snippets (highest similarity first)
   */
  static async retrieve(
    workspaceId: string,
    queryPrompt: string,
    topK: number = 3
  ): Promise<RetrievedSnippet[]> {
    try {
      // Embed the user's query
      const queryVector = await EmbeddingService.embedQuery(queryPrompt);
      if (!queryVector || queryVector.length === 0) return [];

      // Load all stored snippet vectors for this workspace
      const snippets = await prisma.codeSnippet.findMany({
        where: { workspaceId },
        select: { filePath: true, content: true, embedding: true },
      });

      if (snippets.length === 0) return [];

      // Score each snippet using cosine similarity in Node.js
      const scored: RetrievedSnippet[] = [];

      for (const snippet of snippets) {
        const storedVector = snippet.embedding as unknown as number[];
        if (!Array.isArray(storedVector) || storedVector.length === 0) continue;

        const similarity = EmbeddingService.cosineSimilarity(queryVector, storedVector);
        if (similarity >= SIMILARITY_THRESHOLD) {
          scored.push({
            filePath: snippet.filePath,
            content: snippet.content,
            similarity,
          });
        }
      }

      // Sort by similarity descending and return top-K
      return scored
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    } catch (err: any) {
      console.error('[RagRetrieval] Retrieval error (non-fatal):', err?.message ?? err);
      return [];
    }
  }

  // ── FORMAT: Build prompt injection block from retrieved snippets ──────────

  /**
   * Format retrieved snippets into a structured block ready for prompt injection.
   *
   * @param snippets  Retrieved snippet list from `retrieve()`
   * @returns         A formatted string for inclusion in the enhanced prompt
   */
  static formatForPrompt(snippets: RetrievedSnippet[]): string {
    if (snippets.length === 0) return '';

    const header = `Semantically relevant code from this workspace (retrieved via RAG):`;
    const body = snippets
      .map(
        (s, i) =>
          `[${i + 1}] ${s.filePath} — relevance ${(s.similarity * 100).toFixed(0)}%\n` +
          '```\n' +
          s.content.slice(0, 600) +
          (s.content.length > 600 ? '\n... (truncated)' : '') +
          '\n```'
      )
      .join('\n\n');

    return `${header}\n\n${body}`;
  }
}
