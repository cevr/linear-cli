---
"@cvr/linear": minor
---

Upgrade to Effect 4.1.2 while preserving existing command defaults, JSON output, and token/config locations. Configuration files now use Effect's TOML parser instead of a separate dependency.

The upgraded CLI parser rejects repeated single-value flags and unexpected positional arguments. Pass flags such as `--limit` only once and remove surplus arguments from scripts.
