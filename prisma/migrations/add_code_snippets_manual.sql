-- Migration: add_code_snippets
-- Run this directly in your Supabase SQL editor if prisma migrate dev fails.
-- Dashboard: https://supabase.com/dashboard → Your Project → SQL Editor

CREATE TABLE IF NOT EXISTS "CodeSnippet" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeSnippet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CodeSnippet_workspaceId_idx" ON "CodeSnippet"("workspaceId");

ALTER TABLE "CodeSnippet"
    ADD CONSTRAINT "CodeSnippet_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
