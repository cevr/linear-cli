# Linear CLI

A command-line interface for [Linear](https://linear.app) built with Bun and Effect TypeScript.

## Installation

```bash
# Clone and build
git clone <repo>
cd linear
bun install
bun run build

# Add to PATH (symlink to ~/.local/bin)
bun run link
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
linear issue start ABC-123

# View issue details
linear issue view ABC-123

# Create a new issue
linear issue create

# List teams
linear team list
```

## Commands

### Authentication

| Command | Description |
|---------|-------------|
| `linear auth` | Authenticate with Linear (opens browser for API key) |
| `linear auth whoami` | Show current user info |

### Issues

| Command | Description |
|---------|-------------|
| `linear issue list` | List your assigned issues |
| `linear issue view [id]` | View issue details (interactive picker if no ID) |
| `linear issue start [id]` | Start working on an issue |
| `linear issue create` | Create a new issue |

### Teams

| Command | Description |
|---------|-------------|
| `linear team list` | List all teams |

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

```bash
# Install dependencies
bun install

# Run tests
bun run test

# Build binary
bun run build

# Run without building
bun run src/main.ts --help
```

## Architecture

Built with:
- **[Bun](https://bun.sh)**: Fast JavaScript runtime with native compilation
- **[Effect](https://effect.website)**: TypeScript library for type-safe, composable code
- **[@effect/cli](https://github.com/Effect-TS/effect/tree/main/packages/cli)**: CLI framework with prompts and argument parsing
- **[@linear/sdk](https://github.com/linear/linear)**: Official Linear GraphQL SDK

## Credits

Inspired by [schpet/linear-cli](https://github.com/schpet/linear-cli) - the original Linear CLI built with Deno and Cliffy.

## License

MIT
