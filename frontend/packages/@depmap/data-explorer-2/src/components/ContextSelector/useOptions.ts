import { useMemo } from "react";
import { DataExplorerContext } from "@depmap/types";
import {
  isContextAll,
  isNegatedContext,
  loadContextsFromLocalStorage,
} from "../../utils/context";
import { isKnownContext } from "./context-selector-utils";

const compareContextEntries = (
  a: [string, Omit<DataExplorerContext, "expr">],
  b: [string, Omit<DataExplorerContext, "expr">]
) => (a[1].name.toLowerCase() < b[1].name.toLowerCase() ? -1 : 1);

export default function useOptions(
  value: DataExplorerContext | null,
  hashOfSelectedValue: string | null,
  loadedContexts: ReturnType<typeof loadContextsFromLocalStorage>,
  shouldShowSaveButton: boolean,
  includeAllInOptions: boolean
) {
  let unsavedOptions = null;

  if (
    value &&
    hashOfSelectedValue &&
    !isKnownContext(hashOfSelectedValue, loadedContexts) &&
    !isContextAll(value)
  ) {
    unsavedOptions = [
      {
        label: value.name,
        value: isNegatedContext(value)
          ? `not_${hashOfSelectedValue}`
          : hashOfSelectedValue,
      },
    ];
  }

  const userContextOptions = useMemo(() => {
    return Object.entries(loadedContexts)
      .sort(compareContextEntries)
      .map(([hash, context]) => {
        return {
          label: context.name,
          value: hash,
          isLegacyList: !!context.isLegacyList,
        };
      });
  }, [loadedContexts]);

  const outGroupOptions = useMemo(() => {
    return Object.entries(loadedContexts)
      .sort(compareContextEntries)
      .map(([hash, context]) => {
        return {
          label: `Not ${context.name}`,
          // HACK: These hashes can have a "not_" prefix that's a total hack
          // to encode that they should be part of the outgroup options. It's
          // important that these hashes do not leak out into the rest of the
          // system. A proper solution would be to use an object with an
          // { outgroup: true } property as a value for the  dropdowns.
          value: `not_${hash}`,
          isLegacyList: !!context.isLegacyList,
        };
      });
  }, [loadedContexts]);

  return [
    includeAllInOptions ? { label: "All", value: "all" } : null,
    { label: "New", value: "new" },

    value && hashOfSelectedValue !== "all" && !shouldShowSaveButton
      ? { label: "Edit current…", value: "edit" }
      : null,

    Object.keys(loadedContexts).length > 0
      ? { label: "Manage my contexts…", value: "manage" }
      : null,

    unsavedOptions
      ? { label: "Unsaved Contexts", options: unsavedOptions }
      : null,

    { label: "My Contexts", options: userContextOptions },
    { label: "Out Groups", options: outGroupOptions },
  ].filter(Boolean) as object[];
}
