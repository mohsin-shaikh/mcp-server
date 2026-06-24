import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { CancelOrderResponse, Order, OrderListResponse } from "./types.js";

export const SAMPLE_ORDERS: Order[] = [
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

export async function loadOrdersFromFile(path: string): Promise<Order[]> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error(`Orders data at "${path}" must be a JSON array`);
  }

  return parsed as Order[];
}

export function createOrderStore(orders: Order[]): Map<string, Order> {
  return new Map(orders.map((order) => [order.id, structuredClone(order)]));
}

export async function handleOrdersRequest(
  req: IncomingMessage,
  res: ServerResponse,
  store: Map<string, Order>,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const match = /^\/orders\/([^/]+)(?:\/cancel)?$/.exec(url.pathname);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { status: "ok", service: "mock-api-server" });
    return;
  }

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
}

export type OrdersApiServer = {
  server: Server;
  host: string;
  port: number;
  baseUrl: string;
  close: () => Promise<void>;
};

export type StartOrdersApiServerOptions = {
  host?: string;
  port?: number;
  orders?: Order[];
};

export async function startOrdersApiServer(
  options: StartOrdersApiServerOptions = {},
): Promise<OrdersApiServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  const store = createOrderStore(options.orders ?? SAMPLE_ORDERS);

  const server = createServer((req, res) => {
    void handleOrdersRequest(req, res, store);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://${host}:${address.port}`;

  return {
    server,
    host,
    port: address.port,
    baseUrl,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

/** @deprecated Use startOrdersApiServer — kept for existing test imports */
export async function startMockOrdersApi(orders: Order[] = SAMPLE_ORDERS): Promise<{
  server: Server;
  port: number;
  baseUrl: string;
  orders: Order[];
  close: () => Promise<void>;
}> {
  const started = await startOrdersApiServer({ orders });
  return {
    server: started.server,
    port: started.port,
    baseUrl: started.baseUrl,
    orders,
    close: started.close,
  };
}
