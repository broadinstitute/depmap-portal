import { getJson } from "../client";

// The app version (from Breadbox's pyproject.toml, auto-bumped by commitizen
// on every feat/fix(breadbox) commit). The entry points fold this into the
// persistent cache's epoch, so a Breadbox deploy wipes cached responses
// produced by the old server code. Never cache this method — it is the
// epoch's input.
export async function getBreadboxVersion() {
  const response = await getJson<{ message: string; version?: string }>(
    "/health_check/basic"
  );

  if (!response.version) {
    throw new Error("Breadbox did not report a version");
  }

  return response.version;
}
