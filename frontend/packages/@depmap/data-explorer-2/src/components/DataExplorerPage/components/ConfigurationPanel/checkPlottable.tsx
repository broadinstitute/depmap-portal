import React from "react";
import { getConfirmation } from "@depmap/common-components";
import { DepMap } from "@depmap/globals";
import { DataExplorerContextV2, SliceQuery } from "@depmap/types";
import { dataExplorerAPI } from "../../../../services/dataExplorerAPI";

interface Args {
  sliceQuery: SliceQuery;
  dimension_type: string;
  onConvertToColorContext: (context: DataExplorerContextV2) => void;
}

const confirmListValues = () => {
  return getConfirmation({
    title: "Can’t color by multi-valued data",
    message: (
      <div>
        <p>
          This annotation contains lists of values instead of discrete
          categories. Because each item can have multiple values, the plot can’t
          assign a unique color to each point.
        </p>
        <p>Do you want to use it to create a context to color by instead?</p>
      </div>
    ),
    yesText: "Create context",
    noText: "Cancel",
    yesButtonBsStyle: "primary",
  });
};

const confirmManyColors = () => {
  return getConfirmation({
    title: "Too many categorical colors",
    message: (
      <div>
        <p>
          This annotation has too many distinct values. It can’t be used to
          color the plot because it would be impossible to assign a unique color
          to each one.
        </p>
        <p>Do you want to use it to create a context to color by instead?</p>
      </div>
    ),
    yesText: "Create context",
    noText: "Cancel",
    yesButtonBsStyle: "primary",
  });
};

export default async function checkPlottable({
  sliceQuery,
  dimension_type,
  onConvertToColorContext,
}: Args) {
  window.dispatchEvent(new Event("dx2_start_load_event"));
  const domain = await dataExplorerAPI.fetchVariableDomain(sliceQuery);
  window.dispatchEvent(new Event("dx2_end_load_event"));

  if (domain.value_type === "continuous") {
    return true;
  }

  if (
    domain.value_type !== "list_strings" &&
    domain.unique_values.length <= 100
  ) {
    return true;
  }

  const confirmed =
    domain.value_type === "list_strings"
      ? await confirmListValues()
      : await confirmManyColors();

  if (confirmed) {
    const operator = domain.value_type === "list_strings" ? "has_any" : "in";

    DepMap.saveNewContext(
      {
        name: `${sliceQuery.identifier} list`,
        dimension_type,
        expr: { [operator]: [{ var: "0" }, []] },
        vars: { 0: { ...sliceQuery, source: "property" } },
      },
      null,
      onConvertToColorContext
    );
  }

  return false;
}
