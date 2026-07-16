import { Flag } from "effect/unstable/cli";

export const jsonFlag = Flag.boolean("json").pipe(
  Flag.withDescription("Emit stable JSON for scripts and agents"),
);
