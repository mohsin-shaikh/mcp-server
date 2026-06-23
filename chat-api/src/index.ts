import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) =>
  c.json({
    status: "ok",
    message: "chat-api scaffold — orchestrator wiring arrives in Phase 4",
  }),
);

const port = Number(process.env["CHAT_PORT"] ?? 3200);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`chat-api listening on http://127.0.0.1:${info.port}`);
});
