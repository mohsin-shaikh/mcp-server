export type McpStdioServerConfig = {
  id: string;
  transport: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type McpHttpServerConfig = {
  id: string;
  transport: "http";
  url: string;
  apiKey?: string;
};

export type McpServerConfig = McpStdioServerConfig | McpHttpServerConfig;

export type McpToolDefinition = {
  serverId: string;
  name: string;
  namespacedName: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
};

export type ToolResult = {
  content: string;
  isError: boolean;
};

export type McpResourceDefinition = {
  serverId: string;
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
};

export type OpenAIChatCompletionTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
    strict?: boolean;
  };
};
