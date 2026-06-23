const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /api_key=[^&\s]+/gi,
  /token=[^&\s]+/gi,
  /password=[^&\s]+/gi,
  /Authorization:\s*[^\n]+/gi,
];

export function redact(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

export function truncate(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  if (bytes.length <= maxBytes) {
    return redact(text);
  }
  const truncated = new TextDecoder().decode(bytes.slice(0, maxBytes));
  const omitted = bytes.length - maxBytes;
  return `${redact(truncated)}\n\n[truncated, ${omitted} bytes omitted]`;
}

export function parseCommaList(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
