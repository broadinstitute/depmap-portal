// The Node script's way of resolving a context hash (the browser's, in
// context-storage.ts, is built around the Cache API and window.location).
import { breadboxAPI, getRequestFailure } from "@depmap/api";
import { DataExplorerContext, DataExplorerContextV2 } from "@depmap/types";

export default async function fetchContextFromCas(
  hash: string
): Promise<DataExplorerContext | DataExplorerContextV2> {
  let body: { value?: unknown };

  try {
    body = await breadboxAPI.getCasValue(hash);
  } catch (e) {
    // Not "dataset_not_found": it's the config that's wrong, and the caller
    // should be told which kind of thing is missing.
    if (getRequestFailure(e)?.status === 404) {
      throw new Error("A context this plot refers to was not found.");
    }

    throw e;
  }

  if (!body || typeof body.value !== "string") {
    throw new Error("A context this plot refers to could not be read.");
  }

  let context: unknown;

  try {
    context = JSON.parse(body.value);
  } catch (e) {
    throw new Error("A context this plot refers to could not be read.");
  }

  if (!context || typeof context !== "object") {
    throw new Error("A context this plot refers to could not be read.");
  }

  return context as DataExplorerContext | DataExplorerContextV2;
}
