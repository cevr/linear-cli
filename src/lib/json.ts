import { Schema } from "effect";

const JsonText = Schema.fromJsonString(Schema.Unknown);

export const encodeJson = Schema.encodeSync(JsonText);
