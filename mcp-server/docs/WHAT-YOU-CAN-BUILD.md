# What You Can Build with @zuupee/mcp-server

This document describes what you can build on top of this MCP server — a **general-purpose [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) framework** for exposing tools, resources, and prompts to AI clients such as Cursor, Claude Desktop, and MCP Inspector.

The server is **domain-agnostic**. It ships transport, auth, validation, observability, and a small set of generic built-in tools. Everything product-specific — GitHub, Postgres, your internal API — is added as a **module** or **plugin**, not baked into core.

---

## At a glance

| Category                     | What you build                                           | How                                             |
| ---------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| **Custom integrations**      | Domain MCP servers (GitHub, Jira, Stripe, internal APIs) | Plugin under `plugins/` or separate npm package |
| **API bridges**              | REST/OpenAPI-backed tool sets for any HTTP API           | `http` + `openapi` modules, or custom module    |
| **Codebase assistants**      | Repo-aware agents with sandboxed file access             | `filesystem` module + `FS_ROOT`                 |
| **Hosted MCP services**      | Remote MCP for teams or SaaS                             | HTTP transport + API key auth + Docker          |
| **Safe exploration agents**  | Read-only API discovery workflows                        | `READ_ONLY=true` + prompts + allowlists         |
| **Observability-backed ops** | Production MCP with metrics and audit logs               | OpenTelemetry + Prometheus/Grafana stack        |

---

## 1. Foundation: what the framework provides

Before adding domain logic, the server already gives you:

### Transports

| Transport           | Use case                                                         |
| ------------------- | ---------------------------------------------------------------- |
| **stdio**           | Local dev — Cursor, Claude Desktop, MCP Inspector                |
| **Streamable HTTP** | Remote deployment — shared team server, cloud, Docker/Kubernetes |

### MCP capabilities

| Capability    | Purpose                                                                |
| ------------- | ---------------------------------------------------------------------- |
| **Tools**     | Actions the model can invoke (fetch data, call APIs, read files)       |
| **Resources** | Read-only context the model can pull (`mcp://docs/...`, config schema) |
| **Prompts**   | Reusable workflow templates (`explore_api`, `debug_tool_error`, etc.)  |

### Cross-cutting infrastructure

- **Schema-first validation** — Zod input schemas on every tool
- **Module registry** — enable/disable capabilities via `MCP_MODULES`
- **Read-only mode** — `READ_ONLY=true` blocks mutating modules
- **Security defaults** — deny-all HTTP host allowlist, secret redaction, sandboxed filesystem
- **Structured logging** — stderr-only (stdio-safe)
- **OpenTelemetry metrics** — optional OTLP export for tool call telemetry
- **Plugin loader** — dynamic local modules from `plugins/` via `MCP_PLUGINS_DIR`

See [build-plan.md](./build-plan.md) for architecture details and [DEPLOY.md](./DEPLOY.md) for production HTTP deployment.

---

## 2. Built-in modules (starting points)

These ship with the server and can be combined or extended.

### `meta` — server introspection

| Tool          | Use                                              |
| ------------- | ------------------------------------------------ |
| `server_info` | Inspect enabled modules, version, config summary |

**Build with it:** health dashboards, debugging misconfigured clients, agent self-diagnosis.

### `http` — generic HTTP client

| Tool         | Use                                                 |
| ------------ | --------------------------------------------------- |
| `http_fetch` | GET/POST/PUT/PATCH/DELETE against allowlisted hosts |

**Build with it:** quick REST integrations without writing a full module; prototyping API access; calling webhooks.

Requires `HTTP_TOOL_ALLOWED_HOSTS`. Skipped when `READ_ONLY=true`.

### `json` — JSON utilities

| Tool             | Use                                 |
| ---------------- | ----------------------------------- |
| `json_parse`     | Parse JSON strings                  |
| `json_stringify` | Serialize values to formatted JSON  |
| `json_pick`      | Extract dot/bracket paths from JSON |

**Build with it:** response shaping, data extraction pipelines, lightweight ETL in agent workflows.

### `datetime` — time helpers

| Tool              | Use                           |
| ----------------- | ----------------------------- |
| `datetime_now`    | Current time (ISO 8601)       |
| `datetime_format` | Format/parse ISO date strings |

**Build with it:** scheduling agents, log timestamp normalization, time-window queries.

### `docs` — resources and prompts

| Resource / prompt         | Use                              |
| ------------------------- | -------------------------------- |
| `mcp://docs/build-plan`   | Project build plan               |
| `mcp://docs/modules/{id}` | Per-module usage docs            |
| `mcp://config/schema`     | JSON Schema of server config     |
| `explore_api`             | Safe REST API discovery workflow |
| `debug_tool_error`        | Checklist when a tool fails      |
| `design_new_module`       | Guide for adding a new module    |

**Build with it:** self-documenting MCP servers; onboarding agents to your server's capabilities.

### `filesystem` — sandboxed file access (opt-in)

| Tool           | Use                         |
| -------------- | --------------------------- |
| `read_file`    | Read a file under `FS_ROOT` |
| `list_dir`     | List directory entries      |
| `search_files` | Find files by name pattern  |

**Build with it:** codebase Q&A, doc search, config inspection — without giving the agent unrestricted disk access.

Requires `FS_ROOT`. Not enabled by default.

### `openapi` — REST from OpenAPI 3 specs (opt-in)

| Tool                      | Use                                  |
| ------------------------- | ------------------------------------ |
| `openapi_list_operations` | List `operationId`s from a spec URL  |
| `openapi_call`            | Invoke an operation by `operationId` |

**Build with it:** instant MCP tool surface for any documented REST API — Stripe, Twilio, your own services — without hand-writing every endpoint.

Requires `HTTP_TOOL_ALLOWED_HOSTS` for spec and API hosts. Optional default via `OPENAPI_SPEC_URL`.

---

## 3. What you can build: patterns and recipes

### 3.1 Domain-specific MCP servers

The primary extension model. Wrap any backend — REST, GraphQL, gRPC, database, CLI — as MCP tools.

**Examples:**

| Server               | Tools you might expose                                      |
| -------------------- | ----------------------------------------------------------- |
| **GitHub MCP**       | `github_list_prs`, `github_create_issue`, `github_get_file` |
| **Postgres MCP**     | `db_query`, `db_list_tables`, `db_describe_schema`          |
| **Stripe MCP**       | `stripe_list_customers`, `stripe_create_payment`            |
| **Internal CRM MCP** | `crm_search_contacts`, `crm_update_deal`                    |
| **CI/CD MCP**        | `ci_trigger_build`, `ci_get_logs`, `ci_list_pipelines`      |

**Two ways to ship:**

1. **Local plugin** — `plugins/my-service/index.ts` + `MCP_MODULES=meta,my-service`
2. **Separate npm package** — `@your-org/mcp-server-github` depending on `@zuupee/mcp-server`, exporting `McpModule` implementations

Scaffold a plugin:

```bash
pnpm create-module my-service
# Enable with MCP_MODULES=meta,my-service
```

Minimal plugin shape:

```typescript
import { z } from "zod";
import type { McpModule } from "../../src/registry/types.js";
import { toolText } from "../../src/lib/result.js";
import { wrapToolHandler } from "../../src/lib/tool.js";

export const myServiceModule: McpModule = {
  id: "my-service",
  name: "My Service",
  readOnly: true, // false if any tool mutates state
  register(server, ctx) {
    server.registerTool(
      "my_service_list_items",
      {
        title: "List items",
        description: "Fetch items from My Service API.",
        inputSchema: z.object({ limit: z.number().int().max(50).default(20) }),
        annotations: { readOnlyHint: true },
      },
      wrapToolHandler(ctx, "my_service_list_items", async ({ limit }) => {
        const apiKey = ctx.secrets.require("MY_SERVICE_API_KEY");
        const res = await ctx.http.fetch(`https://api.example.com/items?limit=${limit}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        // handle response, return toolText() or toolJson()
      }),
    );
  },
};
```

**Context available to every module:**

| API                      | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `ctx.config`             | Parsed server config                                       |
| `ctx.secrets`            | Env-backed secrets (`get`, `require`) — never in tool args |
| `ctx.http.fetch`         | HTTP client for upstream calls                             |
| `ctx.logger`             | Structured logging with request ID                         |
| `ctx.isHostAllowed(url)` | Host allowlist check                                       |
| `ctx.metrics`            | Tool call telemetry                                        |

See [build-plan.md Appendix A](./build-plan.md) for the full example.

---

### 3.2 OpenAPI-backed API servers (no custom code per endpoint)

For any service with an OpenAPI 3 spec, enable the `openapi` module:

```bash
MCP_MODULES=meta,openapi,json
HTTP_TOOL_ALLOWED_HOSTS=api.stripe.com,raw.githubusercontent.com
OPENAPI_SPEC_URL=https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json
```

**Workflow for agents:**

1. `openapi_list_operations` — discover available `operationId`s
2. `openapi_call` — invoke operations with path params, query, body, headers

**Build with it:**

- Payment/billing agents (Stripe, PayPal)
- Communication agents (Twilio, SendGrid)
- Cloud provider agents (any API with a public OpenAPI spec)
- Internal microservice agents (host your spec, allowlist your API host)

Pair with `READ_ONLY=true` and read-only HTTP methods for safe exploration.

---

### 3.3 Codebase and documentation agents

Enable filesystem access scoped to a project:

```bash
FS_ROOT=/path/to/your/project
MCP_MODULES=meta,docs,filesystem,json
READ_ONLY=true
```

**Build with it:**

- Repo-aware coding assistants in Cursor
- Documentation search and summarization over a monorepo
- Config and schema inspection agents
- Onboarding bots that read `README`, `package.json`, migration files

The agent can `list_dir`, `search_files`, and `read_file` — all paths resolved under `FS_ROOT` with traversal blocked.

---

### 3.4 Safe API exploration agents

Combine read-only mode, HTTP allowlists, and built-in prompts:

```bash
MCP_MODULES=meta,http,json,datetime,docs
READ_ONLY=true
HTTP_TOOL_ALLOWED_HOSTS=api.github.com,httpbin.org
```

**Build with it:**

- Agents that discover unknown REST APIs without write access
- Security-conscious integrations where mutation is never allowed
- Training/demo environments with constrained outbound access

Use the `explore_api` prompt to give agents a structured checklist for safe discovery.

---

### 3.5 Hosted team MCP servers

Deploy over Streamable HTTP for shared access:

```bash
MCP_TRANSPORT=http
MCP_HTTP_HOST=0.0.0.0
MCP_AUTH_MODE=api_key
MCP_API_KEY=your-secret
MCP_MODULES=meta,http,json,docs,my-internal-api
```

**Build with it:**

- Centralized MCP gateway for a team or organization
- Multi-client access (Cursor, custom agents, automation) to the same tool surface
- Docker/Kubernetes deployments with health checks (`GET /health`)
- API-key-gated access to internal integrations

See [DEPLOY.md](./DEPLOY.md) for Docker, graceful shutdown, and the production checklist.

---

### 3.6 Observability-backed production MCP

Enable OpenTelemetry metrics and run the bundled stack:

```bash
OTEL_ENABLED=true
pnpm metrics:up   # OTLP collector + Prometheus + Grafana
```

**Build with it:**

- Tool call dashboards (latency, error rates, per-tool volume)
- SLO monitoring for hosted MCP endpoints
- Capacity planning based on agent usage patterns

See [OBSERVABILITY.md](./OBSERVABILITY.md).

---

### 3.7 Composite agents (mix and match modules)

Modules compose. Common profiles:

| Profile            | Modules                          | Typical use                 |
| ------------------ | -------------------------------- | --------------------------- |
| **Minimal**        | `meta,json,datetime`             | Lightweight utility server  |
| **API worker**     | `meta,http,json,openapi`         | External API integration    |
| **Dev assistant**  | `meta,docs,filesystem,json`      | Local codebase help         |
| **Full generic**   | `*` (all built-in except opt-in) | Maximum built-in capability |
| **Custom product** | `meta,<your-plugins>`            | Domain-specific server      |

Enable with `MCP_MODULES` or `MCP_MODULES=*` for all default built-ins.

---

## 4. Integration patterns (backends you can wrap)

The framework does not ship domain connectors — it documents how to add them:

| Backend                   | Pattern                                                             |
| ------------------------- | ------------------------------------------------------------------- |
| **REST APIs**             | `ctx.http.fetch` in a custom module, or `openapi` module            |
| **GraphQL**               | Custom module: POST to endpoint with query/mutation in tool handler |
| **gRPC**                  | Custom module: use `@grpc/grpc-js` client in `register()`           |
| **SQL databases**         | Custom module: `pg`, `mysql2`, or ORM in tool handlers              |
| **Local CLIs**            | Custom module: `child_process` with command allowlist               |
| **Message queues**        | Custom module: publish/consume via SDK in tools                     |
| **File stores (S3, GCS)** | Custom module: SDK calls; or `filesystem` for local paths           |

**Rules of thumb:**

- Credentials live in env (`ctx.secrets`), never in tool input schemas
- Mutating tools: set `readOnly: false` on the module; use `wrapToolHandler(..., { mutating: true })`
- Large responses: use `truncate()` from `src/lib/result.js`
- Errors: return `toolError()` — no stack traces or secrets in output

---

## 5. Client configurations

### Cursor (local stdio)

```json
{
  "mcpServers": {
    "mcp-server": {
      "command": "pnpm",
      "args": ["--dir", "/path/to/mcp-server", "dev"],
      "env": {
        "MCP_MODULES": "meta,http,json,datetime,docs",
        "READ_ONLY": "true",
        "HTTP_TOOL_ALLOWED_HOSTS": "api.github.com"
      }
    }
  }
}
```

### Published package (npx)

```json
{
  "mcpServers": {
    "mcp-server": {
      "command": "npx",
      "args": ["-y", "@zuupee/mcp-server"],
      "env": {
        "MCP_MODULES": "meta,http,json,datetime",
        "READ_ONLY": "true"
      }
    }
  }
}
```

### Remote HTTP client

Point MCP clients that support Streamable HTTP to `POST https://your-host/mcp` with `X-API-Key` header.

---

## 6. What this server is _not_ for

To set expectations:

| Out of scope                           | Notes                                            |
| -------------------------------------- | ------------------------------------------------ |
| MCP **client**                         | This is server-side only                         |
| Hosted plugin marketplace              | Plugins are local path or separate packages      |
| Deprecated SSE transport               | Use Streamable HTTP for remote                   |
| Unrestricted network/filesystem access | Deny-by-default allowlists and `FS_ROOT` sandbox |
| Product-specific integrations in core  | Add via modules/plugins, don't fork core         |

---

## 7. Getting started checklist

1. **Clone and run locally**

   ```bash
   pnpm install && cp .env.example .env.local
   pnpm dev
   ```

2. **Pick a profile** — choose modules for your use case (see §3.7)

3. **Add domain logic** — `pnpm create-module <name>` or copy `plugins/example/`

4. **Configure security** — `HTTP_TOOL_ALLOWED_HOSTS`, `FS_ROOT`, `READ_ONLY`, `MCP_API_KEY`

5. **Test with MCP Inspector**

   ```bash
   pnpm inspect
   ```

6. **Deploy remotely** (optional) — HTTP transport + Docker ([DEPLOY.md](./DEPLOY.md))

7. **Monitor** (optional) — OpenTelemetry + Grafana ([OBSERVABILITY.md](./OBSERVABILITY.md))

---

## 8. Related docs

| Document                               | Contents                               |
| -------------------------------------- | -------------------------------------- |
| [README.md](../README.md)              | Quick start, tool table, env vars      |
| [build-plan.md](./build-plan.md)       | Architecture, phases, extension guide  |
| [DEPLOY.md](./DEPLOY.md)               | HTTP deployment, Docker, health checks |
| [OBSERVABILITY.md](./OBSERVABILITY.md) | Metrics, Prometheus, Grafana           |
| [RELEASING.md](./RELEASING.md)         | Versioning and npm publish             |

---

## Summary

`@zuupee/mcp-server` is a **framework for building MCP servers**, not a single product integration. You can build:

- **Custom domain servers** via plugins or npm packages
- **Instant API servers** from OpenAPI specs
- **Codebase-aware agents** with sandboxed filesystem access
- **Hosted team gateways** over Streamable HTTP
- **Safe, read-only exploration** agents with allowlists and prompts
- **Production deployments** with auth, metrics, and Docker

The built-in modules (`http`, `json`, `datetime`, `filesystem`, `openapi`, `docs`) are reference implementations and composable building blocks. Domain logic stays in `plugins/` or separate packages — keeping the core stable while your integrations evolve independently.
