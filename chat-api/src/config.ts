import type { LogLevel } from "./logger.js";

export type ChatApiConfig = {
  port: number;
  corsOrigins: string[];
  rateLimitRpm: number;
  apiKey?: string;
  logLevel: LogLevel;
  redisUrl?: string;
  sessionTtlSeconds: number;
};

export function loadChatApiConfig(): ChatApiConfig {
  const corsOrigins = process.env["CHAT_CORS_ORIGINS"]
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? ["http://localhost:5173", "http://localhost:3000"];

  const rateLimitRpm = Number.parseInt(process.env["CHAT_RATE_LIMIT_RPM"] ?? "", 10) || 20;
  const apiKey = process.env["CHAT_API_KEY"]?.trim() || undefined;
  const logLevel = (process.env["LOG_LEVEL"] ?? "info") as LogLevel;
  const redisUrl = process.env["CHAT_REDIS_URL"]?.trim() || undefined;
  const sessionTtlSeconds =
    Number.parseInt(process.env["CHAT_SESSION_TTL_SECONDS"] ?? "", 10) || 86_400;

  return {
    port: Number.parseInt(process.env["CHAT_PORT"] ?? "", 10) || 3200,
    corsOrigins,
    rateLimitRpm,
    apiKey,
    logLevel,
    redisUrl,
    sessionTtlSeconds,
  };
}
