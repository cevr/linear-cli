import { Flag } from "effect/unstable/cli";

export const jsonFlag = Flag.boolean("json").pipe(
  Flag.withDescription("Emit stable JSON for scripts and agents"),
);

export const outputDirFlag = Flag.string("output-dir").pipe(
  Flag.withAlias("o"),
  Flag.withDefault("."),
  Flag.withDescription("Directory to save files in; created when missing"),
);

export const overwriteFlag = Flag.boolean("overwrite").pipe(
  Flag.withDescription("Replace files that already exist in the output directory"),
);
