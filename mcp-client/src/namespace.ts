const NAMESPACE_SEPARATOR = "__";

export function namespaceTool(serverId: string, toolName: string): string {
  return `${serverId}${NAMESPACE_SEPARATOR}${toolName}`;
}

export function parseNamespacedTool(namespacedName: string): {
  serverId: string;
  toolName: string;
} {
  const separatorIndex = namespacedName.indexOf(NAMESPACE_SEPARATOR);
  if (separatorIndex === -1) {
    throw new Error(
      `Invalid namespaced tool name "${namespacedName}" — expected format "serverId__toolName"`,
    );
  }

  const serverId = namespacedName.slice(0, separatorIndex);
  const toolName = namespacedName.slice(separatorIndex + NAMESPACE_SEPARATOR.length);

  if (!serverId || !toolName) {
    throw new Error(
      `Invalid namespaced tool name "${namespacedName}" — expected format "serverId__toolName"`,
    );
  }

  return { serverId, toolName };
}

export function healthUrlFromMcpUrl(mcpUrl: string): string {
  const url = new URL(mcpUrl);
  url.pathname = "/health";
  url.search = "";
  url.hash = "";
  return url.toString();
}
