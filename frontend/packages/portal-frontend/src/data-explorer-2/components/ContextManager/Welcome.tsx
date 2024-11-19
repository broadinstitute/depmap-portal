import React from "react";
import { EditInCellLineSelectorButton } from "@depmap/data-explorer-2";

function Welcome() {
  return (
    <div>
      <p>
        Welcome to Context Manager, a new way to manage your cell line lists.
      </p>
      <p>
        “Contexts” are a more powerful, rules-based approach to defining sets of
        cell lines of interest. It’s often faster and easier to define a rule or
        two than to select individual cell lines by hand. All of your existing
        cell line lists have been converted to contexts and appear in the list
        below.
      </p>
      <p>
        But don’t worry, you can still use Cell Line Selector to make lists if
        that’s your preferred workflow. Look for the “Create new with Cell Line
        Selector” button below.
      </p>
      <p>
        To modify an existing list in Cell Line Selector, open one of the
        contexts below and look for this button ⮕{" "}
        <EditInCellLineSelectorButton onClick={() => {}} />
      </p>
    </div>
  );
}

export default Welcome;
