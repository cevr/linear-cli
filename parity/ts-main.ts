// Offline compiled control only. Install the refusing transport before the CLI
// loads; never ship this entry as bin/linear-ts.
// oxlint-disable import/no-unassigned-import -- Ordered side effects install the transport before the CLI starts.
import "./redirect";
import "../src/main";
