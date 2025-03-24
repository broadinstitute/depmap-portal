import React from "react";

interface Props {
  dataSourceOption: string | null;
}

function HelpText({ dataSourceOption }: Props) {
  if (dataSourceOption === "legacy_metadata_slice") {
    return (
      <span>
        These are older annotations from our legacy database.
        <br />
        <br />
        This list of properties remains available to ease the transition as we
        reorganize this information. The goal is to make the naming consistent
        with what you’ll find in the Downloads section.
      </span>
    );
  }

  if (dataSourceOption === "breadbox_metadata_column") {
    return (
      <span>
        This is an updated and expanded set of annotations from our revised
        database.
        <br />
        <br />
        Where possible, you should prefer to use these, as they will have better
        support going forward.
      </span>
    );
  }

  if (dataSourceOption === "matrix_dataset") {
    return <span>Use this option to compare ranges of numeric values.</span>;
  }

  return null;
}

export default HelpText;
