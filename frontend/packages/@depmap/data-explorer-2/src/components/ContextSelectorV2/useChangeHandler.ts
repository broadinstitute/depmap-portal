import { useMemo } from "react";
import { DepMap } from "@depmap/globals";
import { DataExplorerContextV2 } from "@depmap/types";
import { fetchContext } from "../../utils/context-storage";
import {
  isNegatedContext,
  isV2Context,
  negateContext,
} from "../../utils/context";

type OnChange = (
  context: DataExplorerContextV2 | null,
  hash: string | null
) => void;

const handleCaseAll = (context_type: string, onChange: OnChange) => {
  onChange(
    {
      name: "All",
      dimension_type: context_type,
      expr: true,
      vars: {},
    },
    "all"
  );
};

const handleCaseEdit = (
  value: DataExplorerContextV2 | null,
  hashOfSelectedValue: string | null
) => {
  if (value && hashOfSelectedValue) {
    const valueToEdit = isNegatedContext(value) ? negateContext(value) : value;
    const hashToEdit = hashOfSelectedValue.replace("not_", "");
    DepMap.editContext(valueToEdit, hashToEdit);
  }
};

const handleDefaultCase = async (
  contextHash: string,
  isLegacyList: boolean,
  onChange: OnChange
) => {
  const negate = contextHash.startsWith("not_");
  const hashToFetch = contextHash.replace("not_", "");
  let persistedHash;
  let context: DataExplorerContextV2;

  if (isLegacyList) {
    // TODO: Implement this. The "legacy lists" referred to here go back to the
    // old Cell Line Selector. There's probably not many (if any) of those
    // still hanging around.
    throw new Error("Selection of legacy lists is not yet supported");
  } else {
    const fetchedContext = await fetchContext(hashToFetch);

    if (!isV2Context(fetchedContext)) {
      throw new Error("V1 contexts not supported!");
    }

    context = fetchedContext;
  }

  if (negate && context) {
    context = negateContext(context);
  }

  onChange(context || null, persistedHash || hashToFetch);
};

export default function useChangeHandler(
  context_type: string,
  onChange: OnChange,
  onClickCreateContext: () => void,
  value: DataExplorerContextV2 | null,
  hashOfSelectedValue: string | null
) {
  return useMemo(
    () => async (wrapper: { value: string | null; isLegacyList: boolean }) => {
      const contextHash = wrapper?.value || null;
      const isLegacyList = !!wrapper?.isLegacyList;

      switch (contextHash) {
        case "all":
          return handleCaseAll(context_type, onChange);

        case "new":
          return onClickCreateContext();

        case "edit":
          return handleCaseEdit(value, hashOfSelectedValue);

        case "manage":
          return DepMap.launchContextManagerModal({
            initialContextType: context_type,
          });

        case null:
          return onChange(null, null);

        default:
          return handleDefaultCase(contextHash, isLegacyList, onChange);
      }
    },
    [context_type, onChange, onClickCreateContext, value, hashOfSelectedValue]
  );
}
