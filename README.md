# Linear CLI

A command-line interface for [Linear](https://linear.app), written in
[Ergo](https://github.com/cevr/ergo) and shipped as a native binary. It was a
Bun and Effect program until the Ergo port replaced it; the parity suite holds
the port to that program's recorded output.

## Installation

```bash
bun add --global @cvr/linear    # or: npm install --global @cvr/linear
```

The package carries native binaries for macOS and Linux (arm64 and x64) and a
small `sh` launcher, `bin/linear`, that runs the one for your platform. It has
no postinstall step and needs no Bun or Node at run time.

From a source checkout, build the compiler at the pin in `ergo-toolchain.json`
(`go build ./cmd/ergo` in a checkout of that commit), then:

```bash
bun install
ERGO=/path/to/ergo bun run build       # bin/linear-ergo
bun run link                            # symlink bin/linear to ~/.local/bin
```

## Usage

```bash
# Authenticate (required first)
linear auth

# Check current user
linear auth whoami

# List your issues
linear issue list

# Start working on an issue
linear issue start ABC-123 --dry-run
linear issue start ABC-123 --json

# View issue details
linear issue view ABC-123

# Read one or many issues as JSON
linear issue view ABC-123 ABC-124 --json

# Include comments, sub-issues, and relations
linear issue view ABC-123 --comments --children --relations --json

# Create a new issue with prompts
linear issue create --interactive

# Non-interactive creation with validation
linear issue create --team ABC --title "Title" --project "Tech Debt" --dry-run

# List projects
linear project list --json

# List teams
linear team list
```

## Commands

### Authentication

| Command              | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `linear auth`        | Authenticate with Linear (opens browser for API key) |
| `linear auth whoami` | Show current user info                               |

### Issues

| Command                   | Description                                         |
| ------------------------- | --------------------------------------------------- |
| `linear issue list`       | List your assigned issues                           |
| `linear issue view [id]`  | View issue details; prompts require `--interactive` |
| `linear issue start [id]` | Start work, with `--dry-run` and `--json` support   |
| `linear issue create`     | Create a new issue                                  |
| `linear issue comment ID` | Add a comment, with `--dry-run` support             |
| `linear issue files ID`   | List uploads; `--download` saves them               |

### Files

| Command                     | Description                                         |
| --------------------------- | --------------------------------------------------- |
| `linear file download URL…` | Download `uploads.linear.app` files with your token |

### Teams

| Command            | Description    |
| ------------------ | -------------- |
| `linear team list` | List all teams |

### Projects and GraphQL

| Command                      | Description                                     |
| ---------------------------- | ----------------------------------------------- |
| `linear project list --json` | List projects with stable machine-readable data |
| `linear api graphql`         | Authenticated GraphQL escape hatch              |

## Agent usage

- Add `--json` to reads; commands return stable JSON and meaningful exit codes.
- `issue view --json` always returns an array and accepts multiple identifiers or Linear issue URLs.
- Use `--comments`, `--children`, and `--relations` only when that context is needed.
- Run supported mutations with `--dry-run` before executing them.
- Prompts are opt-in with `--interactive`; missing agent inputs fail fast.
- Prefer typed commands. Use `linear api graphql` only for operations the typed CLI cannot express.
- Keep `--query-file` paths inside the current workspace; traversal and escaping symlinks are rejected.
- Raw GraphQL mutations require the explicit `--allow-mutation` flag.
- Never read or interpolate the token directly; the CLI owns authentication.
- Download attachments with `linear issue files ID --download` or `linear file download URL`. The token is sent only to `uploads.linear.app`, never to a redirect target. Existing files are kept unless `--overwrite` is passed.

## Configuration

- **Token**: `~/.config/linear/token`
- **Global config**: `~/.config/linear/config.toml`
- **Project config**: `.linear.toml` in repo root

### Project Config Example

Create a `.linear.toml` in your project root to set defaults:

```toml
team_id = "ENG"
```

### Environment Variables

- `LINEAR_API_KEY`: Alternative to config file token

## Development

The source is in `ergo/` (see [ergo/README.md](ergo/README.md)). With `ERGO`
naming the pinned compiler:

```bash
bun install                                       # the harness and release tools
bun run build                                     # bin/linear-ergo and bin/linear-ergo-parity
bun parity/run.ts --phase=6                       # fixed cases (parity/cases)
bun parity/run.ts --phase=6 --property=1000       # the generated read property
for r in L0 L3 L4 LUTF8; do bun parity/run.ts --regressions=$r --seed=42; done
bun parity/mutants.ts                             # the mutant ledger
bun scripts/release.ts   # the four native binaries the package ships, in npm/
bun scripts/smoke.ts     # pack, install with bun and npm, run the installed linear
```

The parity suite runs the binary against an offline fake Linear (graphql-js
over the public schema). The expected output is the TypeScript CLI's, recorded
before its source was removed: `parity/cases` for the fixed cases and
`parity/frozen` for the property and regression cases.

CI (`.github/workflows/ci.yml`) builds the pinned compiler and runs the parity
suite; the release workflow builds the binaries on Linux and macOS runners.

## Credits

Inspired by [schpet/linear-cli](https://github.com/schpet/linear-cli) - the original Linear CLI built with Deno and Cliffy.

## License

MIT
