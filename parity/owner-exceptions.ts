// q99 (2026-11-10), an explicit exception to q95, not strict parity.
// This is the complete allowlist for no-terminal and TOML suffix differences.
type Result = { out: string; err: string; status: number; files: unknown[]; mutations: unknown[] };
const noTerminal = new Set(["view-interactive-no-terminal", "create-interactive-no-terminal"]);
const configPrefix: Record<string, string> = {
  "config-malformed": "Config Error: Failed to parse $CASE/.linear.toml: ",
  "config-invalid-type": "Config Error: Invalid Linear config in $CASE/.linear.toml: ",
};

export function q99Equal(name: string, expected: Result, actual: Result): boolean | undefined {
  if (noTerminal.has(name)) {
    if (
      expected.status !== 130 ||
      actual.status !== 1 ||
      expected.err !== "" ||
      actual.out !== "" ||
      actual.err !== "Invalid input: prompts need a terminal on standard input\n"
    )
      throw new Error(`${name}: no-terminal refusal lost its message or status`);
    return (
      JSON.stringify(expected.files) === JSON.stringify(actual.files) &&
      JSON.stringify(expected.mutations) === JSON.stringify(actual.mutations)
    );
  }
  const prefix = configPrefix[name];
  if (!prefix) return undefined;
  if (!expected.err.startsWith(prefix) || !actual.err.startsWith(prefix))
    throw new Error(`${name}: config failure lost its kind or path`);
  if (actual.err.length <= prefix.length + 1)
    throw new Error(`${name}: config failure has no detail`);
  return (
    expected.status === 1 &&
    actual.status === 1 &&
    expected.out === actual.out &&
    JSON.stringify(expected.files) === JSON.stringify(actual.files) &&
    JSON.stringify(expected.mutations) === JSON.stringify(actual.mutations)
  );
}
