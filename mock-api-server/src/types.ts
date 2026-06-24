export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

export type Order = {
  id: string;
  userId: string;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    priceCents: number;
  }>;
};

export type OrderListResponse = {
  orders: Order[];
  total: number;
};

export type CancelOrderResponse = {
  order: Order;
  message: string;
};
