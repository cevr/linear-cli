// Loaded only by the offline parity runner; shipped code has no origin override.
import { resolve } from "node:path";
const expectedHome = process.env.LINEAR_PARITY_HOME;
if (!expectedHome || process.env.HOME !== expectedHome || resolve(".") !== expectedHome) {
  throw new Error("Parity requires HOME and cwd to equal the isolated case directory");
}
const targets = {
  api: process.env.LINEAR_PARITY_ORIGIN,
  storage: process.env.LINEAR_PARITY_STORAGE_ORIGIN,
};
for (const target of Object.values(targets)) {
  if (!target) throw new Error("Missing offline transport origin");
  const url = new URL(target);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.pathname !== "/") {
    throw new Error("Parity transport permits only literal IPv4 loopback HTTP origins");
  }
}
const original = globalThis.fetch;
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  let target: URL;
  if (url.origin === "https://api.linear.app" && url.pathname === "/graphql") {
    target = new URL("/graphql", targets.api);
  } else if (url.origin === "https://uploads.linear.app") {
    target = new URL(`/uploads${url.pathname}${url.search}`, targets.api);
  } else if (
    url.origin === "https://storage.linear-pilot.invalid" ||
    url.origin === new URL(targets.storage!).origin
  ) {
    target = new URL(`${url.pathname}${url.search}`, targets.storage);
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    if (headers.has("authorization")) throw new Error("Credential leaked to fixture storage");
  } else {
    throw new Error(`Offline parity refused origin: ${url.origin}`);
  }
  // Do not let fetch follow a response from the fixture out onto the network.
  const next = input instanceof Request ? new Request(target, input) : target;
  return original(next, { ...init, redirect: "manual" });
}) as typeof fetch;
