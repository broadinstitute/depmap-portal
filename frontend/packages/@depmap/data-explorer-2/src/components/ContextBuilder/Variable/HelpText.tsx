import React from "react";
import { capitalize, getDimensionTypeLabel } from "../../../utils/misc";

interface Props {
  dataSourceOption: string | null;
  slice_type: string;
}

function HelpText({ dataSourceOption, slice_type }: Props) {
  if (dataSourceOption === "legacy_metadata_slice") {
    return (
      <span>
        These are the names of properties of as they appeared in past versions
        of Context Manager. However, these names are inconsistent with the
        property names you’ll see if you download annotations. We are gradually
        updating the portal to consistently use the names as they appear in
        downloads. These legacy names should be considered deprecated and this
        option will be removed in a future update of the portal.
      </span>
    );
  }

  if (dataSourceOption === "official_annotation") {
    return (
      <span>
        This is the set of annotations associated instances of{" "}
        {capitalize(getDimensionTypeLabel(slice_type))}. See the corresponding
        table of annotations in the download section for descriptions of each
        property.
      </span>
    );
  }

  if (dataSourceOption === "matrix_dataset") {
    return (
      <span>
        This is the set of numerical features which are available for instances
        of {capitalize(getDimensionTypeLabel(slice_type))}. You can use these if
        you want to define a context based on some threshold of some measurement
        (i.e. expression, probability of dependency, etc).
      </span>
    );
  }

  return null;
}

export default HelpText;
