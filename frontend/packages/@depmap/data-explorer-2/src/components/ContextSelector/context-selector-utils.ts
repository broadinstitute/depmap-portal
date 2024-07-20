import omit from "lodash.omit";
import { DepMap } from "@depmap/globals";
import { DataExplorerContext } from "@depmap/types";
import { LocalStorageListStore } from "@depmap/cell-line-selector";
import { fetchContext, fetchEntityLabels, persistContext } from "../../api";
import {
  getContextHash,
  isContextAll,
  isNegatedContext,
  negateContext,
} from "../../utils/context";
import { getDimensionTypeLabel } from "../../utils/misc";

export const getPlaceholder = (context_type: string | null) => {
  return `Choose ${
    context_type ? getDimensionTypeLabel(context_type) : ""
  } context…`;
};

export const isKnownContext = (
  contextHash: string,
  loadedContexts: Record<string, unknown>
) => {
  return (
    contextHash === "all" ||
    (loadedContexts != null && contextHash in loadedContexts)
  );
};

export const toContextSelectorHash = async (
  context: DataExplorerContext | null
) => {
  if (!context) {
    return null;
  }

  if (isContextAll(context)) {
    return "all";
  }

  return getContextHash(
    isNegatedContext(context) ? negateContext(context) : context
  );
};

type ContextWithoutExpr = { name: string; context_type: string };
type StoredContexts = Record<string, ContextWithoutExpr>;

const depmapIDsToDisplayNames = async (lines: ReadonlySet<string>) => {
  const out: string[] = [];

  const data = await fetchEntityLabels("depmap_model");
  const names = data.aliases.find((alias) => alias.label === "Cell Line Name")!
    .values;

  data.labels.forEach((label, i) => {
    if (lines.has(label)) {
      out.push(names[i]);
    }
  });

  return out;
};

export const persistLegacyListAsContext = async (
  listName: string
): Promise<[string, DataExplorerContext]> => {
  const store = new LocalStorageListStore();
  const list = store.readList(listName);
  const displayNames = await depmapIDsToDisplayNames(list.lines);

  const context: DataExplorerContext = {
    name: listName,
    context_type: "depmap_model",
    expr: {
      in: [{ var: "slice/cell_line_display_name/all/label" }, displayNames],
    },
  };

  let hash = null;

  try {
    hash = await persistContext(context);

    const json = window.localStorage.getItem("user_contexts");
    const existingContexts: StoredContexts = json ? JSON.parse(json) : {};

    const updatedContexts = {
      ...existingContexts,
      [hash]: omit(context, "expr"),
    };

    window.localStorage.setItem(
      "user_contexts",
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

export const makeChangeHandler = (
  value: DataExplorerContext | null,
  context_type: string,
  forceRefresh: () => void,
  hashOfSelectedValue: string | null,
  onChange: (context: DataExplorerContext | null, hash: string | null) => void,
  onClickCreateContext: () => void
) => async (wrapper: any) => {
  const contextHash = wrapper?.value || null;
  const isLegacyList = !!wrapper?.isLegacyList;

  switch (contextHash) {
    case "all": {
      onChange({ name: "All", context_type, expr: true }, "all");
      return;
    }

    case "new": {
      onClickCreateContext();
      // Fixes a bug where this select becomes unclickable if you
      // cancel the Context Editor.
      forceRefresh();
      return;
    }

    case "edit": {
      if (value && hashOfSelectedValue) {
        const valueToEdit = isNegatedContext(value)
          ? negateContext(value)
          : value;
        const hashToEdit = hashOfSelectedValue.replace("not_", "");
        DepMap.editContext(valueToEdit, hashToEdit);
        forceRefresh();
      }

      return;
    }

    case "manage": {
      DepMap.launchContextManagerModal({ initialContextType: context_type });
      forceRefresh();
      return;
    }

    case null: {
      onChange(null, null);
      return;
    }

    default: {
      const negate = contextHash.startsWith("not_");
      const hashToFetch = contextHash.replace("not_", "");
      let persistedHash;
      let context: DataExplorerContext;

      if (isLegacyList) {
        [persistedHash, context] = await persistLegacyListAsContext(
          hashToFetch
        );
      } else {
        context = await fetchContext(hashToFetch);
      }

      if (negate && context) {
        context = negateContext(context);
      }

      onChange(context || null, persistedHash || hashToFetch);
    }
  }
};
