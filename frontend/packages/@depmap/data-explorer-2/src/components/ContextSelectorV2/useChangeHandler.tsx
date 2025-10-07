import React, { useMemo } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { getConfirmation, showInfoModal } from "@depmap/common-components";
import { DepMap } from "@depmap/globals";
import { DataExplorerContext, DataExplorerContextV2 } from "@depmap/types";
import { fetchContext } from "../../utils/context-storage";
import {
  isNegatedContext,
  isV2Context,
  negateContext,
  saveContextToLocalStorageAndPersist,
} from "../../utils/context";
import { convertContextV1toV2 } from "../../utils/context-converter";

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

export const handleCaseEdit = (
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

  if (isLegacyList) {
    // TODO: Implement this. The "legacy lists" referred to here go back to the
    // old Cell Line Selector. There's probably not many (if any) of those
    // still hanging around.
    throw new Error("Selection of legacy lists is not yet supported");
  }

  let fetchedContext: DataExplorerContext | DataExplorerContextV2;

  try {
    fetchedContext = await fetchContext(hashToFetch);
  } catch (e) {
    showInfoModal({
      title: "Error loading context",
      content: "Unable to load context. It may have not been saved properly.",
    });

    return;
  }

  let context: DataExplorerContextV2;
  let persistedHash;

  if (isV2Context(fetchedContext)) {
    context = fetchedContext;
  } else {
    const convertedContext = await convertContextV1toV2(fetchedContext);
    let success = false;

    try {
      const result = await cached(breadboxAPI).evaluateContext(
        convertedContext
      );
      success = result.ids.length > 0;
    } catch (e) {
      success = false;
    }

    if (success) {
      context = convertedContext;
    } else {
      const confirmed = await getConfirmation({
        title: "Error reading context",
        message: (
          <div>
            <p>
              There was a problem reading the context. Some of the rules may be
              referencing legacy datasets or features that are no longer
              available.
            </p>
            <p>Do you want to open the Context Manager to edit it?</p>
          </div>
        ),
        yesText: "Yes, let‘s try to fix it",
        noText: "Cancel",
        yesButtonBsStyle: "primary",
      });

      if (!confirmed) {
        return;
      }

      const repaired = await DepMap.repairContext(convertedContext);

      if (!repaired) {
        return;
      }

      context = repaired;
    }

    persistedHash = await saveContextToLocalStorageAndPersist(
      context,
      contextHash
    );
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
