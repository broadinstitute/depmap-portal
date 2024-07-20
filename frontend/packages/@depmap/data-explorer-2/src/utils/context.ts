import { Base64 } from "js-base64";
import stableStringify from "json-stable-stringify";
import { DataExplorerContext, StoredContexts } from "@depmap/types";
import { LocalStorageListStore } from "@depmap/cell-line-selector";

export async function getContextHash(context: DataExplorerContext) {
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
  if (["dev.cds.team", "127.0.0.1"].includes(window.location.hostname)) {
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
  contextA: DataExplorerContext | null,
  contextB: DataExplorerContext | null
) {
  if (!contextA || !contextB) {
    return false;
  }

  return JSON.stringify(contextA) === JSON.stringify(contextB);
}

export function entityLabelFromContext(
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

export async function initializeDevContexts() {
  if (!["dev.cds.team", "127.0.0.1"].includes(window.location.hostname)) {
    return;
  }

  if (localStorage.getItem("dev_contexts_by_root_url")) {
    return;
  }

  const cache = await window.caches.open("contexts-v1");
  const keys = await cache.keys();

  const contexts = JSON.parse(localStorage.getItem("user_contexts") || "{}");
  const devContexts: Record<string, string[]> = {};

  keys.forEach((key) => {
    const rootUrl = key.url
      .replace(/\/cas\/.*/, "")
      .replace(window.location.origin, "");
    const hash = key.url.split("/").at(-1) as string;

    if (hash in contexts) {
      devContexts[rootUrl] = (devContexts[rootUrl] || []).concat(hash);
    }
  });

  localStorage.setItem("dev_contexts_by_root_url", JSON.stringify(devContexts));
}
