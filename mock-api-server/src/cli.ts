import { fileURLToPath } from "node:url";
import { loadOrdersFromFile, startOrdersApiServer } from "./server.js";

const defaultDataPath = fileURLToPath(import.meta.resolve("../data/orders.json"));

async function main(): Promise<void> {
  const host = process.env["MOCK_API_HOST"] ?? "127.0.0.1";
  const port = Number.parseInt(process.env["MOCK_API_PORT"] ?? "3999", 10);
  const dataPath = process.env["MOCK_API_DATA_PATH"] ?? defaultDataPath;

  const orders = await loadOrdersFromFile(dataPath);
  const api = await startOrdersApiServer({ host, port, orders });

  console.log(`mock-api-server listening on ${api.baseUrl}`);
  console.log(`Loaded ${orders.length} order(s) from ${dataPath}`);
  console.log("Endpoints: GET /health, GET /orders, GET /orders/:id, POST /orders/:id/cancel");

  const shutdown = async () => {
    await api.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
