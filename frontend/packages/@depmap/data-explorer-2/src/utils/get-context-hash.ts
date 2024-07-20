import { Base64 } from "js-base64";
import stableStringify from "json-stable-stringify";
import { DataExplorerContext } from "@depmap/types";

// This function needed to live in its own file to avoid a dependency cycle
// ¯\_(ツ)_/¯
export default async function getContextHash(context: DataExplorerContext) {
  const json = stableStringify(context);
  const encoded = new TextEncoder().encode(json);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = new Uint8Array(buffer);

  // Passing `true` as a second argument yields a URL-safe encoding...
  let str = Base64.fromUint8Array(bytes, true);

  // ...but js-base64's defintion of "URL-safe" also strips padding.
  // We'll stick it back on.
  const paddingLength = 3 - (bytes.length % 3);
  str += "=".repeat(paddingLength);

  return str;
}
