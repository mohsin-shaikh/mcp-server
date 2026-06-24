# @zuupee/mcp-client

Thin MCP client for connecting to one or more `@zuupee/mcp-server` instances. Wraps `@modelcontextprotocol/client` with multi-server support, namespaced tools, and LLM schema adapters.

## Install

From the monorepo root:

```bash
pnpm install
pnpm -C mcp-client build
```

## Config

Point `MCP_SERVERS_CONFIG` at a JSON file with a `servers` array:

```json
{
  "servers": [
    {
      "id": "core",
      "transport": "stdio",
      "command": "node",
      "args": ["../mcp-server/dist/index.js"],
      "env": {
        "MCP_MODULES": "meta",
        "LOG_LEVEL": "fatal"
      }
    },
    {
      "id": "core-http",
      "transport": "http",
      "url": "http://127.0.0.1:3100/mcp",
      "apiKey": "your-api-key"
    }
  ]
}
```

HTTP auth uses the `X-API-Key` header, aligned with `@zuupee/mcp-server`.

## Usage

```typescript
import {
  McpConnectionManager,
  McpToolRegistry,
  namespaceTool,
  toOpenAITools,
} from "@zuupee/mcp-client";

const manager = new McpConnectionManager([
  {
    id: "core",
    transport: "stdio",
    command: "node",
    args: ["../mcp-server/dist/index.js"],
    env: { MCP_MODULES: "meta", LOG_LEVEL: "fatal" },
  },
]);

await manager.connect();

const registry = new McpToolRegistry(manager);
await registry.refresh();

const tools = registry.listTools();
const openAiTools = toOpenAITools(tools);

const result = await registry.callTool(namespaceTool("core", "server_info"), {});
console.log(result.content);

await manager.close();
```

## Smoke script

```bash
pnpm -C mcp-server build
pnpm -C mcp-client dev
```

## Tool namespacing

Tools are exposed to orchestrators as `{serverId}__{toolName}` (for example `core__server_info`).

## Tests

```bash
pnpm -C mcp-client test
pnpm -C mcp-client test:integration
```

Integration tests spawn a local `@zuupee/mcp-server` over stdio and HTTP.
