import { describe, expect, it } from "vitest";
import { SAMPLE_ORDERS, startOrdersApiServer } from "../src/server.js";

describe("orders API", () => {
  it("returns a single order", async () => {
    const api = await startOrdersApiServer({ orders: SAMPLE_ORDERS });
    try {
      const res = await fetch(`${api.baseUrl}/orders/ord_123`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { id: string; status: string };
      expect(body.id).toBe("ord_123");
      expect(body.status).toBe("shipped");
    } finally {
      await api.close();
    }
  });

  it("lists orders filtered by userId", async () => {
    const api = await startOrdersApiServer({ orders: SAMPLE_ORDERS });
    try {
      const res = await fetch(`${api.baseUrl}/orders?userId=user_42`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { orders: Array<{ id: string }>; total: number };
      expect(body.total).toBe(2);
      expect(body.orders.map((order) => order.id)).toEqual(["ord_123", "ord_456"]);
    } finally {
      await api.close();
    }
  });

  it("cancels an order", async () => {
    const api = await startOrdersApiServer({ orders: SAMPLE_ORDERS });
    try {
      const res = await fetch(`${api.baseUrl}/orders/ord_456/cancel`, { method: "POST" });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { order: { status: string }; message: string };
      expect(body.order.status).toBe("cancelled");
      expect(body.message).toContain("ord_456");
    } finally {
      await api.close();
    }
  });

  it("serves health check", async () => {
    const api = await startOrdersApiServer();
    try {
      const res = await fetch(`${api.baseUrl}/health`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe("ok");
    } finally {
      await api.close();
    }
  });
});
