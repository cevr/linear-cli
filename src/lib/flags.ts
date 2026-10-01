import { Flag } from "effect/cli";

export const jsonFlag = Flag.Boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Emit stable JSON for scripts and agents"),
);

export const outputDirFlag = Flag.String("output-dir").pipe(
  Flag.withAlias("o"),
  Flag.withDefault("."),
  Flag.withDescription("Directory to save files in; created when missing"),
);

export const overwriteFlag = Flag.Boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Replace files that already exist in the output directory"),
);
