/**
 * EmbeddingService — Generates semantic vector embeddings for code and text.
 *
 * Uses the Gemini `text-embedding-004` model to convert text/code into
 * 768-dimensional float vectors. These vectors are the foundation of the
 * RAG (Retrieval-Augmented Generation) pipeline.
 *
 * Two embedding modes:
 *   • embed()        — for indexing documents (code files)   → RETRIEVAL_DOCUMENT
 *   • embedQuery()   — for querying (user prompts)           → RETRIEVAL_QUERY
 *
 * Also provides cosineSimilarity() for in-Node.js vector comparison
 * (no pgvector DB extension required).
 */

import { GEMINI_API_KEY, GEMINI_API_BASE_URL } from '../config/env';

const EMBEDDING_MODEL = 'text-embedding-004';
const API_TIMEOUT_MS = 8000;
const MAX_DOCUMENT_CHARS = 8000; // ~2000 tokens
const MAX_QUERY_CHARS = 4000;    // ~1000 tokens

export class EmbeddingService {
  // ── Document Embedding (for indexing code files) ──────────────────────────

  /**
   * Generate a 768-dim embedding vector for a code document.
   * Uses RETRIEVAL_DOCUMENT task type for optimal document retrieval.
   *
   * @param text  The code/text to embed (truncated to 8000 chars)
   * @returns     A float array of length 768, or null on failure
   */
  static async embed(text: string): Promise<number[] | null> {
    if (!GEMINI_API_KEY) {
      console.warn('[EmbeddingService] GEMINI_API_KEY not set — skipping document embedding');
      return null;
    }
    return EmbeddingService.callEmbeddingApi(
      text.slice(0, MAX_DOCUMENT_CHARS),
      'RETRIEVAL_DOCUMENT'
    );
  }

  // ── Query Embedding (for user prompts at retrieval time) ──────────────────

  /**
   * Generate a 768-dim embedding vector for a user query.
   * Uses RETRIEVAL_QUERY task type — optimised for similarity matching against documents.
   *
   * @param text  The user prompt to embed (truncated to 4000 chars)
   * @returns     A float array of length 768, or null on failure
   */
  static async embedQuery(text: string): Promise<number[] | null> {
    if (!GEMINI_API_KEY) return null;
    return EmbeddingService.callEmbeddingApi(
      text.slice(0, MAX_QUERY_CHARS),
      'RETRIEVAL_QUERY'
    );
  }

  // ── Cosine Similarity ─────────────────────────────────────────────────────

  /**
   * Compute cosine similarity between two vectors.
   * Returns a value in [-1, 1] — higher means more similar.
   * Threshold for relevance: typically > 0.3 for code retrieval.
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    const denominator = Math.sqrt(magA) * Math.sqrt(magB);
    return denominator === 0 ? 0 : dot / denominator;
  }

  // ── Internal API Call ─────────────────────────────────────────────────────

  private static async callEmbeddingApi(
    text: string,
    taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'
  ): Promise<number[] | null> {
    try {
      const url = `${GEMINI_API_BASE_URL}/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          taskType,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Embedding API returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data: any = await res.json();
      const values: number[] = data?.embedding?.values ?? [];

      if (values.length === 0) {
        throw new Error('Gemini returned an empty embedding vector');
      }

      return values;
    } catch (err: any) {
      console.error(`[EmbeddingService] ${taskType} embedding failed:`, err?.message ?? err);
      return null;
    }
  }
}
