import React from "react";
import { getConfirmation, showInfoModal } from "@depmap/common-components";
import { DepMap } from "@depmap/globals";
import { displayLabelFromSliceQuery } from "@depmap/selects";
import { DataExplorerContextV2, SliceQuery } from "@depmap/types";
import {
  dataExplorerAPI,
  DataExplorerApiResponse,
} from "../../../../services/dataExplorerAPI";
import { MAX_PLOTTABLE_CATEGORIES } from "../../../../constants/plotConstants";

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
  let domain: DataExplorerApiResponse["fetchVariableDomain"];

  try {
    window.dispatchEvent(new Event("dx2_start_load_event"));
    domain = await dataExplorerAPI.fetchVariableDomain(sliceQuery);
  } catch (e) {
    window.console.error(e);

    showInfoModal({
      title: "Error loading data",
      content: (
        <div>
          <p>An unexpected error occurred while loading the annonation data.</p>
          <details>{JSON.stringify(e)}</details>
        </div>
      ),
    });

    return false;
  } finally {
    window.dispatchEvent(new Event("dx2_end_load_event"));
  }

  if (domain.value_type === "continuous") {
    return true;
  }

  if (domain.unique_values.length === 0) {
    // It's not entirely exceptional for a re-indexed column to lack any
    // values. We'll consider this plottable (it will just label everything as
    // N/A).
    if (domain.dimension_type !== dimension_type) {
      return true;
    }

    showInfoModal({
      title: "Missing data!",
      content: (
        <div>
          The column “<b>{displayLabelFromSliceQuery(sliceQuery)}</b>” appears
          to lack any values. This could indicate a problem with the database.
        </div>
      ),
    });

    return false;
  }

  if (
    ["categorial", "text"].includes(domain.value_type) &&
    domain.unique_values.length <= MAX_PLOTTABLE_CATEGORIES
  ) {
    return true;
  }

  const confirmed =
    domain.value_type === "list_strings"
      ? await confirmListValues()
      : await confirmManyColors();

  if (confirmed) {
    const operator = domain.value_type === "list_strings" ? "has_any" : "in";
    const rhs = domain.references ? { context: null } : [];

    DepMap.saveNewContext(
      {
        name: `${sliceQuery.identifier} list`,
        dimension_type,
        expr: {
          [operator]: [{ var: "0" }, rhs],
        },
        vars: { 0: { ...sliceQuery, source: "property" } },
      },
      null,
      onConvertToColorContext
    );
  }

  return false;
}
