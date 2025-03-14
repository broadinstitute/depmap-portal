import { useMemo } from "react";
import { DataExplorerContext, DataExplorerContextV2 } from "@depmap/types";
import {
  isContextAll,
  isNegatedContext,
  loadContextsFromLocalStorage,
} from "../../utils/context";
import useContextHash from "./useContextHash";

const EMPTY_OBJECT = {};

const compareContextEntries = (
  a: [string, { name: string }],
  b: [string, { name: string }]
) => (a[1].name.toLowerCase() < b[1].name.toLowerCase() ? -1 : 1);

export default function useOptions(
  value: DataExplorerContext | DataExplorerContextV2 | null,
  dimension_type: string,
  includeAllInOptions: boolean
) {
  const loadedContexts: Record<string, DataExplorerContextV2> = dimension_type
    ? loadContextsFromLocalStorage(dimension_type)
    : EMPTY_OBJECT;

  const userContextOptions = useMemo(() => {
    return Object.entries(loadedContexts)
      .sort(compareContextEntries)
      .map(([hash, context]) => {
        return {
          label: context.name,
          value: hash,
          isLegacyList: Boolean(
            "isLegacyList" in context && context.isLegacyList
          ),
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
          isLegacyList: Boolean(
            "isLegacyList" in context && context.isLegacyList
          ),
        };
      });
  }, [loadedContexts]);

  const {
    isKnownContext,
    hashOfSelectedValue,
    shouldShowSaveButton,
  } = useContextHash(value as DataExplorerContextV2, dimension_type);

  const unsavedOptions = useMemo(() => {
    if (
      value &&
      hashOfSelectedValue &&
      !isKnownContext &&
      !isContextAll(value)
    ) {
      return [
        {
          label: value.name,
          value: isNegatedContext(value)
            ? `not_${hashOfSelectedValue}`
            : hashOfSelectedValue,
        },
      ];
    }

    return null;
  }, [value, hashOfSelectedValue, isKnownContext]);

  return useMemo(() => {
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
  }, [
    hashOfSelectedValue,
    includeAllInOptions,
    loadedContexts,
    outGroupOptions,
    shouldShowSaveButton,
    unsavedOptions,
    userContextOptions,
    value,
  ]);
}
