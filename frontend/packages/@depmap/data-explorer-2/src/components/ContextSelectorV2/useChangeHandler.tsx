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
import { getExpansionRoutes } from "../../utils/expansionRoutes";
import promptForParentContext from "./promptForParentContext";
import { PARENT_PICK_PREFIX } from "./useOptions";

type OnChange = (
  context: DataExplorerContextV2 | null,
  hash: string | null
) => void;

const handleCaseAll = (dimension_type: string, onChange: OnChange) => {
  onChange(
    {
      name: "All",
      dimension_type,
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
  onChange: OnChange,
  setIsLoadingContext: React.Dispatch<React.SetStateAction<boolean>>
) => {
  const negate = contextHash.startsWith("not_");
  const hashToFetch = contextHash.replace("not_", "");

  if (isLegacyList) {
    // TODO: Implement this. The "legacy lists" referred to here go back to the
    // old Cell Line Selector. There's probably not many (if any) of those
    // still hanging around.
    throw new Error("Selection of legacy lists is not yet supported");
  }

  setIsLoadingContext(true);
  let fetchedContext: DataExplorerContext | DataExplorerContextV2;

  try {
    fetchedContext = await fetchContext(hashToFetch);
  } catch (e) {
    showInfoModal({
      title: "Error loading context",
      content: "Unable to load context. It may have not been saved properly.",
    });

    setIsLoadingContext(false);
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
        setIsLoadingContext(false);
        return;
      }

      const repaired = await DepMap.repairContext(convertedContext);

      if (!repaired) {
        setIsLoadingContext(false);
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

  setIsLoadingContext(false);
  onChange(context || null, persistedHash || hashToFetch);
};

export default function useChangeHandler(
  dimension_type: string,
  onChange: OnChange,
  onClickCreateContext: () => void,
  value: DataExplorerContextV2 | null,
  hashOfSelectedValue: string | null,
  setIsLoadingContext: React.Dispatch<React.SetStateAction<boolean>>
) {
  return useMemo(
    () => async (wrapper: { value: string | null; isLegacyList: boolean }) => {
      const contextHash = wrapper?.value || null;
      const isLegacyList = !!wrapper?.isLegacyList;

      // "Transcripts of a gene…" needs a second answer before there's a
      // context to hand back, so it opens a one-question modal — the same
      // shape "new" and "manage" already use. A null hash is handed along with
      // the result, exactly as the "all" sentinel does: the context was
      // manufactured rather than loaded, so there's nothing to look it up by,
      // and the "Save as Context +" button appears for it like any other
      // unsaved context.
      if (contextHash?.startsWith(PARENT_PICK_PREFIX)) {
        const parentType = contextHash.slice(PARENT_PICK_PREFIX.length);
        const route = getExpansionRoutes(dimension_type).find(
          (r) => r.parentType === parentType
        );

        if (!route) {
          return undefined;
        }

        const picked = await promptForParentContext(
          dimension_type,
          route,
          value
        );

        // Cancelling leaves the previous selection alone rather than clearing
        // it — backing out of the modal shouldn't destroy what was there.
        return picked ? onChange(picked, null) : undefined;
      }

      switch (contextHash) {
        case "all":
          return handleCaseAll(dimension_type, onChange);

        case "new":
          return onClickCreateContext();

        case "edit":
          return handleCaseEdit(value, hashOfSelectedValue);

        case "manage":
          return DepMap.launchContextManagerModal({
            initialContextType: dimension_type,
          });

        case null:
          return onChange(null, null);

        default:
          return handleDefaultCase(
            contextHash,
            isLegacyList,
            onChange,
            setIsLoadingContext
          );
      }
    },
    [
      dimension_type,
      onChange,
      onClickCreateContext,
      value,
      hashOfSelectedValue,
      setIsLoadingContext,
    ]
  );
}
