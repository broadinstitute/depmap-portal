import React, { useCallback, useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { breadboxAPI, cached } from "@depmap/api";
import {
  DataExplorerContextV2,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { usePlotlyLoader } from "../../../../contexts/PlotlyLoaderContext";
import {
  getDimensionTypeLabel,
  getExpansionAxis,
  pluralize,
} from "../../../../utils/misc";
import promptForExpansionMembers from "./promptForExpansionMembers";
import styles from "../../styles/ConfigurationPanel.scss";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  // Narrow, so this works in either column: the configuration panel has a
  // dispatch and passes an adapter, while the visualization column has only
  // callbacks threaded down to it.
  onChangeMembers: (members: string[] | null) => void;
  // Counts from the plot response (`expansions[0]`), which is the only thing
  // that knows what was actually drawn. Absent when the control renders in the
  // configuration column, which has no response — there it shows the button
  // without a summary, since every number it could state would be a guess.
  shownCount?: number;
  availableCount?: number;
}

// Says which expansion members the plot is drawing and why, and opens the table
// for changing them.
//
// The "why" is the part a reader can't infer. When more members exist than fit,
// the ones shown are chosen by how much they vary across what's plotted — so
// without a sentence saying so, a partial member set looks like the whole thing
// and an unfamiliar ordering looks arbitrary.
function ExpansionMembersControl({
  plot,
  onChangeMembers,
  shownCount = undefined,
  availableCount = undefined,
}: Props) {
  // Captured here, where there IS a provider, and handed to the modal, which
  // promptForValue renders into a detached div outside the React tree.
  const PlotlyLoader = usePlotlyLoader();
  const [sliceTypeLabel, setSliceTypeLabel] = useState("");

  const expansion = plot.expand_by?.[0];
  const context = expansion?.context as DataExplorerContextV2 | undefined;
  const slice_type = expansion?.slice_type;
  const members = (expansion?.members as string[] | undefined) ?? null;

  const expansionAxis = getExpansionAxis(plot);
  const dataset_id = plot.dimensions?.[expansionAxis]?.dataset_id;
  const index_type = plot.index_type;

  useEffect(() => {
    cached(breadboxAPI)
      .getDimensionTypes()
      .then(() => {
        setSliceTypeLabel(getDimensionTypeLabel(slice_type ?? undefined));
      });
  }, [slice_type]);

  const handleClick = useCallback(async () => {
    if (!context || !slice_type || !dataset_id || !index_type) {
      return;
    }

    const choice = await promptForExpansionMembers({
      context,
      slice_type,
      index_type,
      dataset_id,
      visibleFilter: plot.filters?.visible as DataExplorerContextV2 | undefined,
      currentMembers: members,
      PlotlyLoader,
    });

    // Canceled. Distinct from `{ members: null }`, which is a deliberate
    // "restore default" and does need dispatching.
    if (!choice) {
      return;
    }

    onChangeMembers(choice.members);
  }, [
    context,
    slice_type,
    dataset_id,
    members,
    PlotlyLoader,
    index_type,
    plot.filters,
    onChangeMembers,
  ]);

  if (!expansion || !dataset_id) {
    return null;
  }

  // The control earns its place only when there is a different set of members
  // the user could be looking at. Two ways there isn't, and in both the whole
  // thing — summary and button alike — renders away:
  //
  //   - Nothing was drawn. Opening the table would offer only members that
  //     would also draw nothing. Saying so is worse than saying nothing: any
  //     explanation has to talk about the dataset not tracking the entities the
  //     context named, and "the context" is an idea the plot never exposes.
  //   - Everything the dataset tracks is already on screen. Adding is
  //     impossible and removing is what the legend is for.
  //
  // `undefined` means nobody told us — the configuration column has no plot
  // response — and is deliberately not treated as either case.
  const nothingDrawn = shownCount === 0;
  const nothingLeftToAdd =
    shownCount !== undefined &&
    availableCount !== undefined &&
    shownCount >= availableCount;

  if (nothingDrawn || nothingLeftToAdd) {
    return null;
  }

  const noun = pluralize(sliceTypeLabel || "member").toLowerCase();

  // Every branch reports what was *drawn*, never what was requested or what the
  // cap would allow. Those diverge constantly, because a context names entities
  // and a dataset measures only some of them — which is how the old sentence
  // came to claim numbers the plot had no way to deliver.
  const summary = (() => {
    // The configuration column has no plot response to describe.
    if (shownCount === undefined) {
      return null;
    }

    if (members) {
      return shownCount < members.length ? (
        <>
          Showing {shownCount} of the {members.length} {noun} you chose — the
          rest have no data here.
        </>
      ) : (
        <>
          Showing {shownCount} {noun} you chose.
        </>
      );
    }

    // Nothing to compare against: a hand-picked selection says nothing about
    // the members it passed over, and a categorical dataset can't be asked.
    if (availableCount === undefined) {
      return (
        <>
          Showing {shownCount} {noun} — the ones that vary most across what’s
          plotted.
        </>
      );
    }

    // Reaching here means shownCount < availableCount — the equal case returned
    // above, before this component rendered anything at all.
    return (
      <>
        Showing {shownCount} of {availableCount} {noun} that have data — the
        ones that vary most across what’s plotted.
      </>
    );
  })();

  return (
    <div className={styles.expansionMembers}>
      {summary && (
        <div className={styles.expansionMembersSummary}>{summary}</div>
      )}
      <Button bsSize="xsmall" onClick={handleClick} bsStyle="info">
        Choose {noun}…
      </Button>
    </div>
  );
}

export default ExpansionMembersControl;
