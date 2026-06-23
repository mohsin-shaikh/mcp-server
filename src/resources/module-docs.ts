const MODULE_DOCS: Record<string, string> = {
  meta: `# Meta module

Tools:
- \`server_info\` — returns server name, version, enabled modules, and config summary.

Read-only. Enabled by default.`,
  http: `# HTTP module

Tools:
- \`http_fetch\` — GET/POST/PUT/PATCH/DELETE with headers and body.

Requires \`HTTP_TOOL_ALLOWED_HOSTS\`. Skipped when \`READ_ONLY=true\`.`,
  json: `# JSON module

Tools:
- \`json_parse\` — parse a JSON string
- \`json_stringify\` — serialize a value to formatted JSON
- \`json_pick\` — extract dot/bracket paths from JSON

Read-only. Enabled by default.`,
  datetime: `# Datetime module

Tools:
- \`datetime_now\` — current time in ISO 8601
- \`datetime_format\` — parse and format ISO date strings

Read-only. Enabled by default.`,
  docs: `# Docs module

Resources:
- \`mcp://docs/build-plan\` — project build plan
- \`mcp://docs/modules/{id}\` — per-module usage docs
- \`mcp://config/schema\` — JSON Schema of server config

Prompts:
- \`explore_api\` — safely discover an unknown REST API
- \`debug_tool_error\` — checklist when a tool call fails
- \`design_new_module\` — guide for adding a new McpModule`,
  filesystem: `# Filesystem module

Tools:
- \`read_file\` — read a file under FS_ROOT
- \`list_dir\` — list directory entries under FS_ROOT
- \`search_files\` — find files by name pattern under FS_ROOT

Requires \`FS_ROOT\`. Not enabled by default. All paths are sandboxed; path traversal is blocked.`,
};

export function getModuleDoc(moduleId: string): string | undefined {
  return MODULE_DOCS[moduleId];
}

export function listModuleDocIds(): string[] {
  return Object.keys(MODULE_DOCS);
}
