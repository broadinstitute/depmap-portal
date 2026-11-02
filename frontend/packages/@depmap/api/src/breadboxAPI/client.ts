import { getUrlPrefix, isPortal } from "@depmap/globals";
import createJsonClient from "../createJsonClient";
import type { ClientSettings } from "../createJsonClient";

let settings: ClientSettings | null = null;

// Non-browser callers (like the standalone Node bundle) use this to say where
// Breadbox lives and how to authenticate. It's a no-op for the web apps, which
// never call it and so keep using their page's own origin and cookies.
//
// `baseUrl` replaces the whole URL prefix, so it should point directly at
// Breadbox (e.g. "http://127.0.0.1:8000"), not at the Portal's "/breadbox" proxy.
export function configureBreadboxClient(newSettings: ClientSettings | null) {
  settings = newSettings;
}

const {
  getJson,
  postJson,
  patchJson,
  deleteJson,
  postMultipart,
  patchMultipart,
} = createJsonClient(
  () => `${getUrlPrefix()}${isPortal ? "/breadbox" : ""}`,
  () => settings
);

export {
  getJson,
  postJson,
  patchJson,
  deleteJson,
  postMultipart,
  patchMultipart,
};
