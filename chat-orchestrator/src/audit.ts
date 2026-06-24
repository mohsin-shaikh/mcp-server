import { createHash } from "node:crypto";

export type ToolAuditEntry = {
  sessionId?: string;
  toolName: string;
  argsHash: string;
  latencyMs: number;
  isError: boolean;
};

export type ToolAuditLogger = (entry: ToolAuditEntry) => void;

export function hashToolArgs(args: unknown): string {
  return createHash("sha256").update(JSON.stringify(args)).digest("hex").slice(0, 16);
}
