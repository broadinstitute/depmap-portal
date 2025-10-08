import { LocalStorageListStore } from "@depmap/cell-line-selector";
import { isElara } from "@depmap/globals";
import type {
  DataExplorerContext,
  DataExplorerContextV2,
  StoredContexts,
} from "@depmap/types";
import { isBreadboxOnlyMode } from "../isBreadboxOnlyMode";
import { persistContext } from "./context-storage";

export const isContextAll = (
  context: DataExplorerContext | DataExplorerContextV2
) => {
  // `true` is a special value used to match on anything.
  return Boolean(context) && context.expr === true;
};

export function isNegatedContext(
  context: DataExplorerContext | DataExplorerContextV2 | null
) {
  if (!context) {
    return false;
  }

  if (typeof context.expr !== "object") {
    return false;
  }

  return "!" in context.expr;
}

export const userContextStorageKey = () => {
  if (isElara) {
    return "elara_contexts";
  }

  return "user_contexts";
};

export function loadContextsFromLocalStorage(context_type: string) {
  const out: StoredContexts = {};

  // Legacy cell line lists can act as stand-ins for context. The
  // ContextSelector component has smarts that will convert them to proper
  // contexts upon selection. This means they will gradually disappear over
  // time.
  if (context_type === "depmap_model" && !isElara) {
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

  const json = window.localStorage.getItem(userContextStorageKey());
  const contexts: StoredContexts = json ? JSON.parse(json) : {};

  Object.entries(contexts).forEach(([contextHash, context]) => {
    // Hide any V2 contexts from the legacy interface. This check can be
    // removed after we fully migrate to Breadbox.
    const isCompatible = isBreadboxOnlyMode || context.version !== 2;

    if (context.context_type === context_type && isCompatible) {
      out[contextHash] = context;
    }
  });

  // WORKAROUND: These hosts are special in that they simulates multiple
  // environments (public, Skyros, DMC, PedDep). Each env has its own external
  // storage but shares local storage. That means they can "see" each other's
  // contexts but can't actually fetch them. This mechanism corrects for that.
  if (["dev.cds.team", "127.0.0.1:5000"].includes(window.location.host)) {
    const webpackConfig = document.getElementById("webpack-config");

    let rootUrl = webpackConfig
      ? JSON.parse(webpackConfig.textContent as string).rootUrl
      : window.location.pathname.replace(/([^^])\/.*/, "$1");

    if (window.location.pathname.includes("/breadbox")) {
      rootUrl += "/breadbox";
    }

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

export function isV2Context(
  context: DataExplorerContext | DataExplorerContextV2
): context is DataExplorerContextV2 {
  return "dimension_type" in context;
}

const toStoredContext = (
  context: DataExplorerContext | DataExplorerContextV2
): StoredContexts[string] => {
  return {
    name: context.name,
    context_type: isV2Context(context)
      ? context.dimension_type
      : context.context_type,
    version: isV2Context(context) ? 2 : 1,
  };
};

export async function saveContextToLocalStorageAndPersist(
  context: DataExplorerContext | DataExplorerContextV2,
  hashToReplace?: string | null
) {
  let nextHash;
  const json = window.localStorage.getItem(userContextStorageKey());
  const existingContexts: StoredContexts = json ? JSON.parse(json) : {};

  const updates = await Promise.all(
    Object.entries(existingContexts).map(async ([oldHash, oldValue]) => {
      if (oldHash === hashToReplace) {
        nextHash = await persistContext(context);

        return {
          hash: nextHash,
          value: toStoredContext(context),
        };
      }

      return { hash: oldHash, value: oldValue };
    })
  );

  if (!hashToReplace) {
    nextHash = await persistContext(context);

    updates.push({
      hash: nextHash,
      value: toStoredContext(context),
    });
  }

  const updatedContexts: StoredContexts = {};

  updates.forEach(({ hash, value }) => {
    updatedContexts[hash] = value;
  });

  window.localStorage.setItem(
    userContextStorageKey(),
    JSON.stringify(updatedContexts)
  );

  // WORKAROUND: These hosts are special in that they simulates multiple
  // environments (public, Skyros, DMC, PedDep). Each env has its own external
  // storage but shares local storage. That means they can "see" each other's
  // contexts but can't actually fetch them. This mechanism corrects for that.
  if (["dev.cds.team", "127.0.0.1:5000"].includes(window.location.host)) {
    const webpackConfig = document.getElementById("webpack-config");

    let rootUrl = webpackConfig
      ? JSON.parse(webpackConfig.textContent as string).rootUrl
      : window.location.pathname.replace(/([^^])\/.*/, "$1");

    if (window.location.pathname.includes("/breadbox")) {
      rootUrl += "/breadbox";
    }

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
  const json = window.localStorage.getItem(userContextStorageKey());
  const existingContexts: StoredContexts = json ? JSON.parse(json) : {};

  const updatedContexts: StoredContexts = {};

  Object.entries(existingContexts).forEach(([oldHash, oldContext]) => {
    if (oldHash !== hashToDelete) {
      updatedContexts[oldHash] = oldContext;
    }
  });

  window.localStorage.setItem(
    userContextStorageKey(),
    JSON.stringify(updatedContexts)
  );
}

// https://www.typescriptlang.org/docs/handbook/2/functions.html#function-overloads
// prettier-ignore
export function negateContext(context: DataExplorerContext): DataExplorerContext;
// prettier-ignore
export function negateContext(context: DataExplorerContextV2): DataExplorerContextV2;
export function negateContext(
  context: DataExplorerContext | DataExplorerContextV2
) {
  const name = context.name.startsWith("Not ")
    ? context.name.slice(4)
    : `Not ${context.name}`;

  const prevExpr = context.expr as any;
  const expr = prevExpr["!"] ? prevExpr["!"] : { "!": prevExpr };

  if (isV2Context(context)) {
    return {
      name,
      dimension_type: context.dimension_type,
      expr,
      vars: context.vars,
    };
  }

  return {
    name,
    context_type: context.context_type,
    expr,
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

    if (context.expr.or[i]["=="]) {
      return context.expr.or[i]["=="][1];
    }
  }

  return null;
}

// This is called when loading the main DepMap bundle (which all Portal pages
// depend on). It ensures that the `loadContextsFromLocalStorage()` function
// defined above works correctly in our dev environments. Those environments
// share a common domain so extra care is needed to make sure that they can't
// see each other's contexts in local storage.
export async function initializeDevContexts() {
  // Only run  in local and dev environments.
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

  const contexts = JSON.parse(
    localStorage.getItem(userContextStorageKey()) || "{}"
  );
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
