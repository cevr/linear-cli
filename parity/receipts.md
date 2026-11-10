# L7 count receipts

**Measured**, linux/x64, pinned compiler `50facc08`, Go 1.27.0, share C
(`GOMAXPROCS=2`, Go `-p 2`, nice 19, umask 022). This is the full port, not
the planning probe. The shared host was loaded: load averages started at
46.29 / 48.10 / 44.56 and ended at 46.35 / 48.08 / 44.57. No latency, build,
test, install or peak-memory comparison was measured in this window.

All ratios below are **Ergo / TypeScript**; a smaller number is a lower count.

| Count                                                                |   Ratio |
| -------------------------------------------------------------------- | ------: |
| Production executable bytes                                          | 0.09983 |
| Production executable bytes, native linked with `-s -w`              | 0.06865 |
| Startup syscalls, direct production `--version`, one sample per side | 0.27526 |
| Fake requests, `team list --json`                                    | 1.00000 |
| Fake requests, view one issue with children/comments/relations       | 0.50000 |
| Fake requests, view five issues with children/comments/relations     | 0.56604 |
| Fake requests, `issue list --limit 50 --json`                        | 0.20000 |

The request jobs use the same seed-2 world, expanded to five existing issues,
with page size 2 and no added delay. Each side gets a fresh world. Outputs must
match (help layout is the declared exception); every request must authenticate;
mutations and credential-bearing storage requests are refused. Origin-free
startup/help/comment-dry jobs make no fake requests on either side, so their
request ratio is undefined, not zero. Syscall totals use
`strace -f -c -S calls -U calls,name`; counts vary with runtime scheduling and
are not a latency result. The stripped-size comparison is a separate linker
configuration, not a claim about the default build or package installation.

## Reproduce counts

Build both production binaries and the two offline controls (see `routing.md`).
Also build the stripped native control:

```sh
GOFLAGS='-p=2 "-ldflags=-s -w"' "$ERGO" build ergo/cmd/linear -o bin/linear-ergo-stripped
LINEAR_PARITY_SCRATCH=/tmp/opencode/linear-l7 bun parity/receipts.ts
```

The scratch directory must be owned by this run. The driver gives every child
a synthetic HOME, fixture token and its own process group. It reports ratios,
load and a raw JSON path. Retain the raw receipt before removing private caches.
The driver does not collect timings/RSS without `--quiet`.

## Deferred and unmet dependencies

- Start-to-exit and peak RSS: 50 interleaved pairs of version/help/comment dry
  run; command time and peak RSS: 30 pairs of each read above, first zero delay,
  then 20 ms per GraphQL request. Exact deferred commands and build/check/test
  pair jobs are in the pilot run's `bench-pending.md` and L7 files.
- Cold, unchanged and one-comment-edit builds; compiler check versus
  `tsc --noEmit`; all native package tests versus Vitest: pending a quiet window.
- The total global-install footprint and install-time pair are not inferred
  from executable size. T2 (released prebuilt artifacts) and owner approval
  block publication and installation work.
- T1 is absent at the unchanged pin: `ergo version` exits 1 with
  `unknown command version; use ergo --help`. It blocks compiler-reported
  provenance; local builds retain the explicit source hash. No re-pin is made.

**Inferred:** lower request counts remove request work, but counts alone cannot
establish a wall-time gain. No performance speedup is claimed.
