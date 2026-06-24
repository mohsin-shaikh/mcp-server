export function parseCliArgs(argv: string[]): { message: string; verbose: boolean } {
  const raw = argv.slice(2);
  const verbose = raw.includes("--verbose");
  const args = raw.filter((arg) => arg !== "--verbose");
  const start = args[0] === "--" ? 1 : 0;
  const message = args.slice(start).join(" ").trim();

  return { message, verbose };
}
