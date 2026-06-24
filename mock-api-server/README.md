# @zuupee/mock-api-server

Local JSON HTTP API that mimics an orders backend for development and tests. Used by the `orders` MCP plugin via `ORDERS_API_BASE_URL`.

## Run

```bash
pnpm dev:mock-api-server
```

Defaults:

- URL: `http://127.0.0.1:3999`
- Data: `data/orders.json`

## Environment

| Variable             | Default              | Description               |
| -------------------- | -------------------- | ------------------------- |
| `MOCK_API_HOST`      | `127.0.0.1`          | Bind host                 |
| `MOCK_API_PORT`      | `3999`               | Listen port               |
| `MOCK_API_DATA_PATH` | `./data/orders.json` | Path to orders JSON array |

## Endpoints

| Method | Path                 | Description                         |
| ------ | -------------------- | ----------------------------------- |
| `GET`  | `/health`            | Liveness                            |
| `GET`  | `/orders`            | List orders (`?userId=`, `?limit=`) |
| `GET`  | `/orders/:id`        | Get order by ID                     |
| `POST` | `/orders/:id/cancel` | Cancel order                        |

## Wire to MCP orders plugin

```bash
# Terminal 1
pnpm dev:mock-api-server

# Terminal 2 — mcp-server with orders module
cd mcp-server
ORDERS_API_BASE_URL=http://127.0.0.1:3999 \
ORDERS_API_ALLOWED_HOSTS=127.0.0.1 \
MCP_MODULES=meta,orders \
pnpm dev
```

## Programmatic use (tests)

```typescript
import { startOrdersApiServer, SAMPLE_ORDERS } from "@zuupee/mock-api-server";

const api = await startOrdersApiServer({ orders: SAMPLE_ORDERS });
// api.baseUrl → use as ORDERS_API_BASE_URL
await api.close();
```
