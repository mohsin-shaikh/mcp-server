import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { CancelOrderResponse, Order, OrderListResponse } from "../../plugins/orders/types.js";

const SAMPLE_ORDERS: Order[] = [
  {
    id: "ord_123",
    userId: "user_42",
    status: "shipped",
    totalCents: 4999,
    currency: "USD",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-02T14:30:00.000Z",
    items: [
      {
        sku: "SKU-001",
        name: "Widget Pro",
        quantity: 1,
        priceCents: 4999,
      },
    ],
  },
  {
    id: "ord_456",
    userId: "user_42",
    status: "processing",
    totalCents: 2599,
    currency: "USD",
    createdAt: "2026-06-10T08:15:00.000Z",
    updatedAt: "2026-06-10T08:15:00.000Z",
    items: [
      {
        sku: "SKU-002",
        name: "Gadget Mini",
        quantity: 2,
        priceCents: 1299,
      },
    ],
  },
];

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export type MockOrdersApi = {
  server: Server;
  port: number;
  baseUrl: string;
  orders: Order[];
  close: () => Promise<void>;
};

export async function startMockOrdersApi(orders: Order[] = SAMPLE_ORDERS): Promise<MockOrdersApi> {
  const store = new Map(orders.map((order) => [order.id, structuredClone(order)]));

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const match = /^\/orders\/([^/]+)(?:\/cancel)?$/.exec(url.pathname);

    if (req.method === "GET" && url.pathname === "/orders") {
      const userId = url.searchParams.get("userId") ?? undefined;
      const limit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
      let filtered = [...store.values()];
      if (userId) {
        filtered = filtered.filter((order) => order.userId === userId);
      }
      if (Number.isFinite(limit) && limit > 0) {
        filtered = filtered.slice(0, limit);
      }

      const body: OrderListResponse = {
        orders: filtered,
        total: filtered.length,
      };
      sendJson(res, 200, body);
      return;
    }

    if (req.method === "GET" && match && !url.pathname.endsWith("/cancel")) {
      const order = store.get(match[1] ?? "");
      if (!order) {
        sendJson(res, 404, { error: "Order not found" });
        return;
      }
      sendJson(res, 200, order);
      return;
    }

    if (req.method === "POST" && match && url.pathname.endsWith("/cancel")) {
      await readBody(req);
      const order = store.get(match[1] ?? "");
      if (!order) {
        sendJson(res, 404, { error: "Order not found" });
        return;
      }

      order.status = "cancelled";
      order.updatedAt = new Date().toISOString();
      const body: CancelOrderResponse = {
        order,
        message: `Order ${order.id} cancelled`,
      };
      sendJson(res, 200, body);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    server,
    port,
    baseUrl,
    orders: [...store.values()],
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

export { SAMPLE_ORDERS };
