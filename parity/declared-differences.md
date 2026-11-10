# Declared differences

These are the plan's approved limits, not automatic exclusions of failing cases.

- Help text and usage-error layout use Ergo std `flag`; failure status remains 1.
- Effect CLI `--wizard`, `--completions`, and `--log-level` are not ported.
- Text after `Invalid GraphQL document: ` is the port parser's diagnostic.
- JSON escapes U+2028 and U+2029. Record keys otherwise retain construction order.
- Human table width is measured in UTF-16 units, matching JavaScript.
- The native client sends smaller documents and may make fewer requests; semantic
  mutation inputs, output and token reach must still agree.

Downloads (L4):

- Upload URLs normalize the HTTPS default port (including leading zeros),
  scheme/host casing, slash/backslash separators, dot segments (including
  escaped dots), outer ASCII whitespace and path/query/fragment encoding before
  checked origin validation. The old blanket refusal of these inputs is removed.
  User information and non-default ports are still refused; neither can widen
  the origin to which the upload credential belongs.
- The original follows one redirect and sends no token on it. The port follows one
  redirect through the std http network policy; the token is a credential of the
  upload origin, so a redirect back to that origin carries it and any other origin
  does not. A second redirect is `Linear API Error: Download failed: more than 1
redirect for URL`, where the original reports the redirect's HTTP status.
- A response body is held in memory up to 64 MiB (67,108,864 bytes); a larger one
  is a `Download failed` API error. The original has no limit.
- Transport failure and `File Error:` texts are the port's own; the prefix and
  exit status 1 are kept.

Prompts and auth (L5):

- Prompts are std `prompt` machines on std `term`. They draw on standard error,
  so standard output holds only the result; the original draws on standard
  output. Frames, colors and key handling are std's: Escape, Ctrl-C and Ctrl-D
  cancel (`Cancelled`, status 1).
- A prompt needs a terminal on standard input. With none, the port fails with
  `Invalid input: prompts need a terminal on standard input` and status 1. The
  original reads keys from the pipe and, at its end, exits 130 with no error line
  (cases `view-interactive-no-terminal`, `create-interactive-no-terminal`).
  **Owner-approved exception to q95: q99** (2026-11-10, pilot decisions.md).
  Round 2 proceeds on the orchestrator's instruction to retain this exception;
  this is not byte/status equality with TS.
- An issue choice shows `ID: title - state` on every line; the original shows
  the state only for the highlighted line.
- Interactive create feeds the create machine in its order (team, title,
  description). A rejected title stops before the description is asked; the
  original asks the description and then rejects the title.
- `auth` trims the pasted key before it checks it (the original checks the
  untrimmed key and saves it trimmed). An empty key is
  `Invalid input: API key cannot be empty`. The key is saved only after Linear
  accepts it, 0600, as the original does. The parity entry never starts `open`.
- `auth` reads the bare argv `auth` before the command tree: std flag has no
  command that both runs and has subcommands (neutral gap in the pilot's notes).

Config files (L6):

- The files, their order (`./.linear.toml`, `./linear.toml`, then
  `~/.config/linear/config.toml`; the first that is there counts) and the
  `team_id` key are the original's. TOML is std `toml` (TOML 1.0).
- After `Failed to parse PATH: ` and `Invalid Linear config in PATH: ` the text
  is the port's (`line 1, key team_id: unclosed string`;
  `expected a string at team_id`); the prefix, the path and status 1 are kept.
  **Owner-approved suffix exception to q95: q99** (2026-11-10, pilot decisions.md).
  Round 2 retains only these TOML diagnostic suffix differences, not raw-query
  variables or workspace-file errors.
- Unknown keys are skipped, as the original's schema does.

Performance receipts (L7) are not native-parity claims. The local switch and
its unconditional native default are described in `routing.md`. No installed command is changed
by this branch.
