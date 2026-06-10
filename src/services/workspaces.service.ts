import { Response } from "express";
import { z } from "zod";
import prisma from "../config/prisma";
import { redactPII } from "../utils/redactPII";
import { Message, FileData } from "../types/workspace";


const CREDIT_COST_PER_GENERATION = 1;
const MIN_CREDITS_TO_GENERATE = 1;

// Dynamic imports for ESM modules in CommonJS backend
let GoogleGenAIClass: any = null;
let AgentClass: any = null;
let createToolFn: any = null;

async function loadAIModules() {
  if (!GoogleGenAIClass) {
    const genaiMod = await import("@google/genai");
    GoogleGenAIClass = genaiMod.GoogleGenAI;
  }
  if (!AgentClass || !createToolFn) {
    const clineMod = await import("@cline/sdk");
    AgentClass = clineMod.Agent;
    createToolFn = clineMod.createTool;
  }
}

function sseEvent(type: string, payload: unknown): string {
  return `data: ${JSON.stringify({ type, ...(payload as object) })}\n\n`;
}

function extractThoughtLabel(text: string): string | null {
  const boldMatch = text.match(/\*\*([^*]{4,60})\*\*/);
  if (boldMatch) return boldMatch[1].trim();

  const sentence = text.split(/[.\n]/)[0].trim();
  if (sentence.length >= 8 && sentence.length <= 80) return sentence;

  return null;
}

async function validateDependencies(
  deps: Record<string, string>
): Promise<Record<string, string>> {
  const valid: Record<string, string> = {};
  await Promise.all(
    Object.entries(deps).map(async ([pkg, version]) => {
      try {
        const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`, {
          signal: AbortSignal.timeout(1500),
        });
        if (res.ok) valid[pkg] = version;
      } catch {
        // silently skip hallucinated packages
      }
    })
  );
  return valid;
}

function trimHistory(messages: Message[]): Message[] {
  if (messages.length <= 10) return messages;
  return [messages[0], ...messages.slice(-8)];
}

const SYSTEM_PROMPT = `You are an expert React developer. Your job is to generate complete, working React applications based on user prompts.

RULES:
1. Always respond with a valid JSON object — no markdown fences, no extra text.
2. The JSON must match this exact shape:
{
  "assistantMessage": "<brief explanation of what you built/changed>",
  "title": "<short 2-4 word title for the app, e.g. 'Todo List App'>",
  "files": {
    "/App.js": { "code": "<full file content>" },
    "/components/SomeComponent.js": { "code": "<full file content>" }
  },
  "dependencies": {
    "some-package": "latest"
  }
}
3. Use React (functional components + hooks). Do NOT use TypeScript in generated files.
4. Use Tailwind CSS for all styling. Do not use CSS modules or inline styles unless absolutely necessary.
5. The entry point must always be /App.js and must export a default component.
6. All imports must reference files you include in "files" or packages in "dependencies".
7. Do not include react, react-dom, or tailwindcss in "dependencies" — they are always available.
8. When modifying existing code, include ALL files (both changed and unchanged) in "files".
9. Keep code clean, readable, and production-quality.
10. If the user attaches an image, use it as a design reference and match the layout/style as closely as possible.`;

function buildContents(messages: Message[], fileData: FileData | null) {
  const trimmed = trimHistory(messages);

  return trimmed.map((msg, idx) => {
    const role = msg.role === "assistant" ? "model" : "user";

    if (msg.role === "user") {
      const parts: any[] = [];
      let text = msg.content;

      if (msg.imageUrl) {
        text = `[The user has attached an image. Use this URL directly in the generated app where relevant (as img src, background-image, etc.): ${msg.imageUrl}]\n\n${text}`;
      }

      const isLast = idx === trimmed.length - 1;
      if (isLast && fileData) {
        text +=
          "\n\nCurrent project files for context:\n" +
          JSON.stringify(fileData, null, 2);
      }

      parts.push({ text });
      return { role, parts };
    }

    return { role, parts: [{ text: msg.content }] };
  });
}

export interface GenerateCodeStreamOptions {
  userId: string;
  workspaceId: string | null;
  messages: Message[];
  fileData: FileData | null;
}

export const generateCodeStream = async (
  options: GenerateCodeStreamOptions,
  res: Response
) => {
  const { userId, workspaceId, messages, fileData } = options;

  await loadAIModules();

  // Verify user and credits
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, credits: true },
  });

  if (!user) {
    res.write(sseEvent("error", { message: "User not found" }));
    res.end();
    return;
  }

  if (user.credits < MIN_CREDITS_TO_GENERATE) {
    res.write(sseEvent("error", { message: "Insufficient credits" }));
    res.end();
    return;
  }

  const startTime = Date.now();
  let accumulated = "";
  let lastEmitTime = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;

  try {
    const contents = buildContents(messages, fileData);

    const ai = new GoogleGenAIClass({ apiKey: process.env.GEMINI_API_KEY! });
    const geminiStream = await ai.models.generateContentStream({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7,
        responseMimeType: "application/json",
        thinkingConfig: {
          includeThoughts: true,
        },
      },
    });

    for await (const chunk of geminiStream) {
      // Gather token usage metadata if available
      if (chunk.usageMetadata) {
        promptTokens = chunk.usageMetadata.promptTokenCount ?? promptTokens;
        completionTokens = chunk.usageMetadata.candidatesTokenCount ?? completionTokens;
        totalTokens = chunk.usageMetadata.totalTokenCount ?? totalTokens;
      }

      const parts = chunk.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (!part.text) continue;

        if (part.thought) {
          const now = Date.now();
          if (now - lastEmitTime > 600) {
            const label = extractThoughtLabel(part.text);
            if (label) {
              res.write(sseEvent("status", { message: label }));
              lastEmitTime = now;
            }
          }
        } else {
          accumulated += part.text;
        }
      }
    }

    // Parse the result
    let parsed: {
      assistantMessage: string;
      title?: string;
      files: Record<string, { code: string }>;
      dependencies: Record<string, string>;
    };

    try {
      parsed = JSON.parse(accumulated);
    } catch (err) {
      res.write(sseEvent("error", { message: "AI returned invalid JSON. Please try again." }));
      res.end();
      return;
    }

    const { assistantMessage, title: aiTitle, files, dependencies } = parsed;

    if (!files || typeof files !== "object") {
      res.write(sseEvent("error", { message: "AI response missing files. Please try again." }));
      res.end();
      return;
    }

    res.write(sseEvent("status", { message: "Validating packages…" }));
    const validatedDeps = await validateDependencies(dependencies ?? {});
    const newFileData: FileData = {
      files,
      dependencies: validatedDeps,
      title: aiTitle,
    };

    res.write(sseEvent("status", { message: "Saving…" }));

    const lastUserMessage = messages[messages.length - 1];
    const updatedMessages = [
      ...messages,
      { role: "assistant", content: assistantMessage },
    ];

    const [dbWorkspace] = await prisma.$transaction([
      workspaceId
        ? prisma.workspace.update({
            where: { id: workspaceId, userId },
            data: {
              messages: updatedMessages as any,
              fileData: newFileData as any,
            },
          })
        : prisma.workspace.create({
            data: {
              userId,
              title: aiTitle ?? lastUserMessage.content.slice(0, 80),
              messages: updatedMessages as any,
              fileData: newFileData as any,
            },
          }),
      prisma.user.update({
        where: { id: userId },
        data: { credits: { decrement: CREDIT_COST_PER_GENERATION } },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });

    const latency = Math.max(0, Date.now() - startTime);

    // Write observational log for this user prompt generation
    await prisma.inferenceLog.create({
      data: {
        workspaceId: dbWorkspace.id,
        provider: "gemini",
        model: "gemini-3.5-flash",
        latency,
        promptTokens: promptTokens || Math.ceil(JSON.stringify(contents).length / 4),
        completionTokens: completionTokens || Math.ceil(accumulated.length / 4),
        totalTokens: totalTokens || Math.ceil((JSON.stringify(contents).length + accumulated.length) / 4),
        status: "success",
        inputPreview: redactPII(lastUserMessage.content).slice(0, 1000),
        outputPreview: redactPII(assistantMessage).slice(0, 1000),
      },
    });

    res.write(
      sseEvent("done", {
        workspaceId: dbWorkspace.id,
        assistantMessage,
        fileData: newFileData,
        creditsRemaining: updatedUser?.credits ?? user.credits - CREDIT_COST_PER_GENERATION,
      })
    );
    res.end();
  } catch (err: any) {
    console.error("[generateCodeStream] error:", err);
    const latency = Math.max(0, Date.now() - startTime);

    if (workspaceId) {
      await prisma.inferenceLog.create({
        data: {
          workspaceId,
          provider: "gemini",
          model: "gemini-3.5-flash",
          latency,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          status: "error",
          inputPreview: redactPII(messages[messages.length - 1]?.content ?? "").slice(0, 1000),
          errorMessage: err.message || "Unknown error",
        },
      });
    }

    res.write(sseEvent("error", { message: err.message || "Something went wrong." }));
    res.end();
  }
};

export interface ImproveCodeStreamOptions {
  userId: string;
  workspaceId: string;
  userRequest: string;
  fileData: FileData;
}

export const improveCodeStream = async (
  options: ImproveCodeStreamOptions,
  res: Response
) => {
  const { userId, workspaceId, userRequest, fileData } = options;

  await loadAIModules();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, credits: true, plan: true },
  });

  if (!user) {
    res.write(sseEvent("error", { message: "User not found" }));
    res.end();
    return;
  }

  if (user.plan !== "pro") {
    res.write(sseEvent("error", { message: "Upgrade required" }));
    res.end();
    return;
  }

  if (user.credits < MIN_CREDITS_TO_GENERATE) {
    res.write(sseEvent("error", { message: "Insufficient credits" }));
    res.end();
    return;
  }

  const startTime = Date.now();
  const patchedFiles = { ...fileData.files };
  let finalSummary = "";
  let agentOutputText = "";

  const updateFileTool = createToolFn({
    name: "update_file",
    description: "Update or rewrite a file in the React sandbox. Call once per file you need to change.",
    inputSchema: z.object({
      path: z.string().describe("File path exactly as it appears, e.g. /App.js"),
      code: z.string().describe("Complete new contents of the file"),
      reason: z.string().describe("One sentence explaining what you changed and why"),
    }),
    async execute({ path, code, reason }: { path: string; code: string; reason: string }) {
      patchedFiles[path] = { code };
      res.write(sseEvent("file_patch", { path, code, reason }));
      return `Updated ${path}: ${reason}`;
    },
  });

  const doneImprovingTool = createToolFn({
    name: "done_improving",
    description: "Call this when you have finished making all improvements.",
    inputSchema: z.object({
      summary: z.string().describe("A short friendly summary of all the improvements you made (1-3 sentences)"),
    }),
    lifecycle: { completesRun: true },
    async execute({ summary }: { summary: string }) {
      finalSummary = summary;
      return "Done.";
    },
  });

  const fileContext = Object.entries(fileData.files)
    .map(([path, { code }]) => `// ${path}\n${code}`)
    .join("\n\n---\n\n");

  const agent = new AgentClass({
    providerId: "gemini",
    modelId: "gemini-3.5-flash",
    apiKey: process.env.GEMINI_API_KEY!,
    maxIterations: 8,
    systemPrompt: `You are an expert React developer improving a live browser preview app.

The app uses React (functional components), Tailwind CSS for styling, and runs in Sandpack.
You CANNOT use TypeScript, CSS modules, or real npm install — only what's already available.
Available packages: react, react-dom, tailwindcss (CDN), lucide-react, recharts, react-router-dom, framer-motion, date-fns, zod, react-hook-form.

Here are the current files:

${fileContext}

WORKFLOW:
1. Understand what the user wants improved.
2. Identify which files need to change.
3. Call update_file for each file that needs changes (always include the COMPLETE file, not just the diff).
4. Once all files are updated, call done_improving with a short summary.

RULES:
- Always write complete file contents — never partial snippets.
- Keep all existing functionality unless asked to remove it.
- The entry point is always /App.js with a default export.
- All imports must reference files you've updated or packages in the available list above.`,
    tools: [updateFileTool, doneImprovingTool],
    toolPolicies: {
      update_file: { autoApprove: true },
      done_improving: { autoApprove: true },
    },
  });

  agent.subscribe((event: any) => {
    if (event.type === "assistant-text-delta" && event.text) {
      agentOutputText += event.text;
      res.write(sseEvent("thinking", { text: event.text }));
    }

    if (event.type === "tool-started") {
      const name = event.toolCall?.toolName;
      if (name === "update_file") {
        const path = (event.toolCall?.input as any)?.path ?? "a file";
        res.write(sseEvent("thinking", { text: `\n\nUpdating \`${path}\`…` }));
      } else if (name === "done_improving") {
        res.write(sseEvent("thinking", { text: "\n\nFinalizing improvements…" }));
      }
    }
  });

  try {
    res.write(sseEvent("status", { message: "Cline agent starting…" }));
    const result = await agent.run(userRequest);

    if (result.status === "failed") {
      throw new Error(result.error?.message ?? "Agent run failed");
    }

    const newFileData: FileData = {
      files: patchedFiles,
      dependencies: fileData.dependencies,
      title: fileData.title,
    };

    await prisma.$transaction([
      prisma.workspace.update({
        where: { id: workspaceId, userId },
        data: { fileData: newFileData as any },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { credits: { decrement: CREDIT_COST_PER_GENERATION } },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });

    const latency = Math.max(0, Date.now() - startTime);

    // Compute token estimates for the Agent's overall operation
    const promptTokens = Math.ceil(fileContext.length / 4) + Math.ceil(userRequest.length / 4);
    const completionTokens = Math.ceil(agentOutputText.length / 4);
    const totalTokens = promptTokens + completionTokens;

    // Log the Agent usage observably!
    await prisma.inferenceLog.create({
      data: {
        workspaceId,
        provider: "gemini",
        model: "gemini-3.5-flash",
        latency,
        promptTokens,
        completionTokens,
        totalTokens,
        status: "success",
        inputPreview: redactPII(userRequest).slice(0, 1000),
        outputPreview: redactPII(finalSummary || result.outputText || "").slice(0, 1000),
      },
    });

    res.write(
      sseEvent("done", {
        fileData: newFileData,
        summary: finalSummary || result.outputText,
        creditsRemaining: updatedUser?.credits ?? user.credits - CREDIT_COST_PER_GENERATION,
      })
    );
    res.end();
  } catch (err: any) {
    console.error("[improve] error:", err);
    const latency = Math.max(0, Date.now() - startTime);

    await prisma.inferenceLog.create({
      data: {
        workspaceId,
        provider: "gemini",
        model: "gemini-3.5-flash",
        latency,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        status: "error",
        inputPreview: redactPII(userRequest).slice(0, 1000),
        errorMessage: err.message || "Unknown error",
      },
    });

    res.write(sseEvent("error", { message: err.message || "Something went wrong." }));
    res.end();
  }
};
