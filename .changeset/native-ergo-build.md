---
"@cvr/linear": minor
---

`linear` is now a native binary built with [Ergo](https://github.com/cevr/ergo). The package holds a small `sh` launcher and one binary per platform. It no longer compiles with Bun at install time and needs no Bun or Node to run.

What you will notice:

- Supported platforms are macOS and Linux on arm64 and x64. On any other platform the launcher prints one line and exits 1.
- Cancelling a prompt (Escape, Ctrl-C or Ctrl-D) exits 1 with `Cancelled`. Before, it exited 130. A prompt with no terminal on standard input fails with a message instead of reading from the pipe.
- Help and usage-error text use a new layout. Failures still exit 1.
- `--wizard`, `--completions` and `--log-level` are gone.
- Upload URLs that carry user information or a port other than 443 are refused.
- Each command sends one smaller GraphQL request. JSON output escapes U+2028 and U+2029.
