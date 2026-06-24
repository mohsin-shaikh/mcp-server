const DEFAULT_MAX_BYTES = 32 * 1024;

export function truncateToolResult(content: string, maxBytes: number = DEFAULT_MAX_BYTES): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);

  if (bytes.length <= maxBytes) {
    return content;
  }

  const truncated = new TextDecoder().decode(bytes.slice(0, maxBytes));
  const omitted = bytes.length - maxBytes;
  return `${truncated}\n\n[truncated ${omitted} bytes — result exceeded ${maxBytes} byte limit]`;
}
