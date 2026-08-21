import React from "react";
import { getConfirmation, showInfoModal } from "@depmap/common-components";
import { DepMap } from "@depmap/globals";
import { displayLabelFromSliceQuery } from "@depmap/selects";
import { DataExplorerContextV2, SliceQuery } from "@depmap/types";
import {
  dataExplorerAPI,
  DataExplorerApiResponse,
} from "../../../../services/dataExplorerAPI";
import { isIdentifierLike } from "../../../../utils/bestCategories";

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

const confirmIdentifierLike = (distinct: number) => {
  return getConfirmation({
    title: "Too many distinct values to color by",
    message: (
      <div>
        <p>
          This annotation has {distinct.toLocaleString()} distinct values with
          no good way to rank them. A context lets you pick out the items you
          care about and color those. Do you want to create one instead?
        </p>
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

  // Raw cardinality is deliberately not checked here any more. It used to
  // refuse anything past 300 distinct values and offer to build a context
  // instead, which was wrong three times over: the palette holds 18, not 300,
  // so the number being enforced was not the one that governs the picture; the
  // refusal happened mid-selection, before anything had been drawn, even though
  // a high-cardinality annotation costs no more to fetch than a low-cardinality
  // one; and it treated one threshold as the whole story when most of the range
  // above 18 is a perfectly good annotation with more values than colors.
  //
  // How many categories can be *drawn* is now settled at render time, where the
  // best ones are kept and the rest bucketed, with a control to change it. That
  // also covers `color_by: "custom"`, which this function never saw. What
  // survives here is only the far end of the range, where no ranking helps —
  // see the identifier-ratio check below.
  //
  // (It also carried a typo — `"categorial"` — that made genuinely categorical
  // columns miss this early return and reach the modal no matter how few values
  // they had. That is most of why the gate felt so heavy-handed.)

  // Offers to turn the annotation into a context instead of coloring by it,
  // for the two cases where coloring by it directly can't work. Shared so the
  // two differ only in what they say, not in what they build.
  const offerContext = async (
    confirm: () => Promise<boolean>,
    nameSuffix: string
  ) => {
    const confirmed = await confirm();

    if (confirmed) {
      // A reference column gets `in_context` rather than `in` with a context
      // right-hand side. That pairing is a leftover from when `in_context` was
      // a pseudo-operator that flattened to `in` on emission; it is a real
      // operator now (see _in_context in breadbox's context.py), and the
      // builder treats `in` with a `{ context }` value as incoherent.
      const isReference = Boolean(domain.references);

      const operator = (() => {
        if (isReference) {
          return "in_context";
        }

        // Both are the list-membership operator for their value type (see
        // operatorsByValueType): the user is picking a set of values to keep,
        // and for a multi-valued column membership means "has any of these".
        return domain.value_type === "list_strings" ? "has_any" : "in";
      })();

      const rhs = isReference ? { context: null } : [];

      DepMap.saveNewContext(
        {
          name: `${sliceQuery.identifier} ${nameSuffix}`,
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
  };

  // Multi-valued columns are a different problem, and still unsolved: a point
  // belonging to several categories at once has no single color to take.
  // Checked before the ratio below, because when a column is both, "it holds
  // lists" is the more specific and more actionable thing to say.
  if (domain.value_type === "list_strings") {
    return offerContext(confirmListValues, "list");
  }

  // Read out here rather than inside the callback below: `domain` is a `let`
  // (the try/catch above needs it to be), so TypeScript drops the narrowing
  // that ruled out the continuous shape as soon as a closure captures it.
  const distinctCount = domain.unique_values.length;
  const describedCount = domain.value_count;

  // The far end of the range the block above stopped policing, and the only
  // place cardinality still decides anything: a column with roughly one value
  // per item identifies items instead of grouping them, so ranking the values
  // and keeping the best few has nothing to work with. See isIdentifierLike for
  // why this is a ratio rather than a count.
  if (isIdentifierLike(distinctCount, describedCount)) {
    return offerContext(
      () => confirmIdentifierLike(distinctCount),
      "selection"
    );
  }

  return true;
}
