ready

Protocol: supplied orchestrate worker protocol, Implementor (protocol.md/safety.md not read).
Spec: `/home/exedev/.cache/baton/wf10/cli-pilots/plan.md` §§3.2–3.3, round-2 start message and L4 findings.
Head: `d7e810a3fee73b59ba4af47b13b1b465d61a7bc7` (code; request commit follows).
Base: `de8e54af02de352d4fa7bd7b8b1784b14341bdfb`.
Diff: `15 files changed, 525 insertions(+), 97 deletions(-)` (combined repair).

## Fix report and files

M1: fixed d7e810a. `ergo/linear/upload.ergo` normalizes HTTPS default ports before exact origin validation, plus casing, dot/escaped-dot paths, existing escapes, separators, whitespace and component encoding. Checked construction and origin-bound credentials stay intact. Guard `upload-rejects-default-port` fails strict compiled-TS/native output/files/status comparison. Existing host-prefix mutant now fails a strengthened foreign-origin law: reject a longer hostname, never rewrite it to the trusted host.

`parity/regressions.ts`, `run.ts`, `mutants.ts`, ledger/docs and `declared-differences.md` carry the shared property and remove the blanket normalization refusal. Other combined changes repair L0/L3 and q99 declarations.

## Run and receipts [measured]

Workspace `/home/exedev/Developer/personal/.worktrees/linear-ergo-r2`, branch ergo-port; pin `50facc08` unchanged. Build offline controls per `parity/README.md` and L0 request, using isolated HOME and explicit private caches; umask 022, nice 19, GOMAXPROCS=1, Go -p 1.

- Gate: `sh /home/exedev/.cache/baton/wf10/cli-pilots/linear-r2-gate.sh`; `L4/gate-2.log`, final `GATE EXIT: 0`. Strict seeds 42/1000, fixed/generated downloads, foreign-origin law, 42 product/3 harness mutants pass.
- Acceptance at code head: `bun parity/run.ts --regressions=L4 --seed=42 --trace`; `bun parity/run.ts --phase=4`. `L4/accept-2.log`, `ACCEPT EXIT: 0`: canonical URL, bytes, status, files and mutations match. Every storage exchange rejects Authorization; upload credentials bind only to their own origin.
- Red at base against compiled TS: `L4/red-2.log`, `RED EXIT: 1`, default-port URL refusal. No flake or assertion removal.

## Limits

User information/non-default ports remain refused as before; no general WHATWG, speed, macOS or install claim. Existing body/transport limits unchanged. No token/live service, push, installed-link change or production-origin override. Child groups checked; private caches removed before READY. Untouched compiler residue baseline remains excluded (`RESIDUE EXIT: 1`, old CU7 prose; `CACHE COVERAGE EXIT: 0`). Supplied no-worker-scope rule followed over common.md's departure with an 8GiB kernel data-memory ceiling. Canonical: wf10 `cli-pilots/L4/round-2-request.md`.
