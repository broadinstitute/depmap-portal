import React from "react";
import { getConfirmation } from "@depmap/common-components";

export const confirmDeleteContext = (contextName: string) => {
  const skip =
    window.localStorage.getItem("suppress-delete-context-warning") === "true";

  if (skip) {
    return Promise.resolve(true);
  }

  return getConfirmation({
    title: "Are you sure?",
    message: (
      <div>
        <p style={{ fontSize: 16 }}>
          Are you sure you want to delete the context “{contextName}
          ”?
        </p>
        <div>
          <label style={{ fontWeight: "normal", cursor: "pointer" }}>
            <input
              type="checkbox"
              defaultChecked={false}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                if (e.target.checked) {
                  window.localStorage.setItem(
                    "suppress-delete-context-warning",
                    "true"
                  );
                } else {
                  window.localStorage.removeItem(
                    "suppress-delete-context-warning"
                  );
                }
              }}
            />
            <span style={{ margin: 5, verticalAlign: "top" }}>
              Don’t show this again
            </span>
          </label>
        </div>
      </div>
    ),
    noText: "Cancel",
    yesText: "Delete",
    showModalBackdrop: false,
  });
};
