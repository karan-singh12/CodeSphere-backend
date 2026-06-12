export type MessageRole = "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
  imageUrl?: string;
}

export interface FileData {
  files: Record<string, { code: string }>;
  dependencies: Record<string, string>;
  title?: string;
  template?: string;
}

export interface WorkspaceData {
  id: string;
  title: string | null;
  messages: unknown;
  fileData: unknown;
}
