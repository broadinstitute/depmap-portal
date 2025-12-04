import React from "react";
import { getConfirmation } from "@depmap/common-components";

export default function confirmManualSelectMode() {
  return getConfirmation({
    title: "Switch to manual selection?",
    message: (
      <p>
        This will discard your existing rules and create a fixed list of
        selected rows.
      </p>
    ),
    yesText: "Switch to Manual Mode",
    noText: "Cancel",
    yesButtonBsStyle: "primary",
    dontShowAgainLocalStorageKey:
      "suppress-context-builder-manual-mode-warning",
  });
}
