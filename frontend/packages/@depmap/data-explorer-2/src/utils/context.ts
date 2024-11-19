import {
  DataExplorerContext,
  DataExplorerContextV2,
  StoredContexts,
} from "@depmap/types";
import { LocalStorageListStore } from "@depmap/cell-line-selector";
import { persistContext } from "../api";

export const isContextAll = (context: DataExplorerContext) => {
  // `true` is a special value used to match on anything.
  return Boolean(context) && context.expr === true;
};

export function isNegatedContext(context: DataExplorerContext | null) {
  if (!context) {
    return false;
  }

  if (typeof context.expr !== "object") {
    return false;
  }

  return "!" in context.expr;
}

export function loadContextsFromLocalStorage(context_type: string) {
  const out: StoredContexts = {};

  // Legacy cell line lists can act as stand-ins for context. The
  // ContextSelector component has smarts that will convert them to proper
  // contexts upon selection. This means they will gradually disappear over
  // time.
  if (context_type === "depmap_model") {
    const store = new LocalStorageListStore();
    store.importFromOldCellLineHighlighterIfExists();

    store
      .getLists()
      .reverse()
      .forEach((list) => {
        out[list.name] = {
          name: list.name,
          context_type: "depmap_model",
          isLegacyList: true,
        };
      });
  }

  const json = window.localStorage.getItem("user_contexts");
  const contexts: StoredContexts = json ? JSON.parse(json) : {};

  Object.entries(contexts).forEach(([contextHash, context]) => {
    if (context.context_type === context_type) {
      out[contextHash] = context;
    }
  });

  // WORKAROUND: These hosts are special in that they simulates multiple
  // environments (public, Skyros, DMC, PedDep). Each env has its own external
  // storage but shares local storage. That means they can "see" each other's
  // contexts but can't actually fetch them. This mechanism corrects for that.
  if (["dev.cds.team", "127.0.0.1:5000"].includes(window.location.host)) {
    const { rootUrl } = JSON.parse(
      document.getElementById("webpack-config")!.textContent as string
    );
    const devContextsByRootUrl = JSON.parse(
      window.localStorage.getItem("dev_contexts_by_root_url") || "{}"
    );
    const devContexts = new Set(devContextsByRootUrl[rootUrl] || []);

    Object.keys(out).forEach((hash) => {
      if (!devContexts.has(hash)) {
        delete out[hash];
      }
    });
  }

  return out;
}

const stripExprFromContext = (context: DataExplorerContext) => {
  const { expr, ...rest } = context;
  return rest;
};

// TODO: Rename this to communicate that it also persists it to a bucket.
export async function saveContextToLocalStorage(
  context: DataExplorerContext,
  hashToReplace?: string | null
) {
  let nextHash;
  const json = window.localStorage.getItem("user_contexts");
  const existingContexts: StoredContexts = json ? JSON.parse(json) : {};

  const updates = await Promise.all(
    Object.entries(existingContexts).map(async ([oldHash, oldValue]) => {
      if (oldHash === hashToReplace) {
        nextHash = await persistContext(context);

        return {
          hash: nextHash,
          value: stripExprFromContext(context),
        };
      }

      return { hash: oldHash, value: oldValue };
    })
  );

  if (!hashToReplace) {
    nextHash = await persistContext(context);

    updates.push({
      hash: nextHash,
      value: stripExprFromContext(context),
    });
  }

  const updatedContexts: StoredContexts = {};

  updates.forEach(({ hash, value }) => {
    updatedContexts[hash] = value;
  });

  window.localStorage.setItem("user_contexts", JSON.stringify(updatedContexts));

  // WORKAROUND: These hosts are special in that they simulates multiple
  // environments (public, Skyros, DMC, PedDep). Each env has its own external
  // storage but shares local storage. That means they can "see" each other's
  // contexts but can't actually fetch them. This mechanism corrects for that.
  if (["dev.cds.team", "127.0.0.1:5000"].includes(window.location.host)) {
    const { rootUrl } = JSON.parse(
      document.getElementById("webpack-config")!.textContent as string
    );

    const devContextsByRootUrl = JSON.parse(
      window.localStorage.getItem("dev_contexts_by_root_url") || "{}"
    );

    const devContexts = devContextsByRootUrl[rootUrl] || [];
    devContextsByRootUrl[rootUrl] = [...new Set(devContexts.concat(nextHash))];

    window.localStorage.setItem(
      "dev_contexts_by_root_url",
      JSON.stringify(devContextsByRootUrl)
    );
  }

  return nextHash as string;
}

// This only deletes the entry from the map of hashes to names. The content of
// the context still persists in the CAS.
export function deleteContextFromLocalStorage(hashToDelete: string) {
  const json = window.localStorage.getItem("user_contexts");
  const existingContexts: StoredContexts = json ? JSON.parse(json) : {};

  const updatedContexts: StoredContexts = {};

  Object.entries(existingContexts).forEach(([oldHash, oldContext]) => {
    if (oldHash !== hashToDelete) {
      updatedContexts[oldHash] = oldContext;
    }
  });

  window.localStorage.setItem("user_contexts", JSON.stringify(updatedContexts));
}

export function negateContext(context: DataExplorerContext) {
  const negateExpr = (expr: any) => (expr["!"] ? expr["!"] : { "!": expr });

  return {
    name: context.name.startsWith("Not ")
      ? context.name.slice(4)
      : `Not ${context.name}`,
    context_type: context.context_type,
    expr: negateExpr(context.expr),
  };
}

export function contextsMatch(
  contextA: DataExplorerContext | DataExplorerContextV2 | null,
  contextB: DataExplorerContext | DataExplorerContextV2 | null
) {
  if (!contextA || !contextB) {
    return false;
  }

  return JSON.stringify(contextA) === JSON.stringify(contextB);
}

export function sliceLabelFromContext(
  context: DataExplorerContext | null | undefined
): string | null {
  if (!context?.expr) {
    return null;
  }

  if (typeof context.expr !== "object") {
    return null;
  }

  // An expression of the form { "==": [varLookup, testValue] }
  if (context.expr["=="]) {
    return context.expr["=="][1];
  }

  if (context.expr.or) {
    const i = context.expr.or.length - 1;
    return context.expr.or[i]["=="][1];
  }

  return null;
}

// This is called when loading the main DepMap bundle (which all Portal pages
// depend on). It ensures that the `loadContextsFromLocalStorage()` function
// defined above works correctly in our dev environments. Those environments
// share a common domain so extra care is needed to make sure that they can't
// see each other's contexts in local storage.
export async function initializeDevContexts() {
  // Only run in local and dev environments.
  if (!["dev.cds.team", "127.0.0.1:5000"].includes(window.location.host)) {
    return;
  }

  // Bail out if we've already initialized this item.
  if (localStorage.getItem("dev_contexts_by_root_url")) {
    return;
  }

  // Peek at the cache and see what contexts exist there.
  const cache = await window.caches.open("contexts-v1");
  const keys = await cache.keys();

  const contexts = JSON.parse(localStorage.getItem("user_contexts") || "{}");
  const devContexts: Record<string, string[]> = {};

  // Now organize them by their url prefix.
  keys.forEach((key) => {
    const rootUrl = key.url
      .replace(/\/cas\/.*/, "")
      .replace(window.location.origin, "");
    const hash = key.url.split("/").at(-1) as string;

    if (hash in contexts) {
      devContexts[rootUrl] = (devContexts[rootUrl] || []).concat(hash);
    }
  });

  // Initialize the item. It will be updated whenever a new context is saved.
  localStorage.setItem("dev_contexts_by_root_url", JSON.stringify(devContexts));
}
