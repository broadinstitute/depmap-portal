import omit from "lodash.omit";
import type { DataExplorerContextV2, StoredContexts } from "@depmap/types";
import { LocalStorageListStore } from "./compatibility/ListStorage";
import { userContextStorageKey } from "./context";
import { persistContext } from "./context-storage";

export const persistLegacyListAsContext = async (
  listName: string
): Promise<[string, DataExplorerContextV2]> => {
  const store = new LocalStorageListStore();
  const list = store.readList(listName);

  const context: DataExplorerContextV2 = {
    name: listName,
    dimension_type: "depmap_model",
    expr: { in: [{ var: "given_id" }, list.lines] },
    vars: {},
  };

  let hash = null;

  try {
    hash = await persistContext(context);

    const json = window.localStorage.getItem(userContextStorageKey());
    const existingContexts: StoredContexts = json ? JSON.parse(json) : {};

    const updatedContexts = {
      ...existingContexts,
      [hash]: omit(context, "expr"),
    };

    window.localStorage.setItem(
      userContextStorageKey(),
      JSON.stringify(updatedContexts)
    );

    store.delete(listName);
  } catch (e) {
    window.console.error(e);
    throw new Error(
      `Error persisting cell line list "${listName}" as a context.`
    );
  }

  return [hash, context];
};
