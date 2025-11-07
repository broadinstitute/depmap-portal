import React from "react";
import { getConfirmation } from "@depmap/common-components";

export const confirmDeleteContext = (contextName: string) => {
  return getConfirmation({
    title: "Are you sure?",
    message: (
      <div>
        <p style={{ fontSize: 16 }}>
          Are you sure you want to delete the context “{contextName}
          ”?
        </p>
      </div>
    ),
    noText: "Cancel",
    yesText: "Delete",
    showModalBackdrop: false,
    dontShowAgainLocalStorageKey: "suppress-delete-context-warning",
  });
};
