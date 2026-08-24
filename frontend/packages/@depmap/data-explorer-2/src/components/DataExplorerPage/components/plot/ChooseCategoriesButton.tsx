import React, { useCallback } from "react";
import { Button } from "react-bootstrap";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
} from "@depmap/types";
import { useDataExplorerSettings } from "../../../../contexts/DataExplorerSettingsContext";
import { SOFT_MAX_CATEGORIES } from "../../../../constants/plotConstants";
import {
  chosenCategoriesFor,
  findCategoricalSlice,
  getShownCategories,
  resolveColorMode,
} from "./prototype/plotUtils";
import promptForCategories from "./promptForCategories";
import styles from "../../styles/DataExplorer2.scss";

interface Props {
  data: DataExplorerPlotResponse | null;
  plotConfig: DataExplorerPlotConfig | null;
  target: "color" | "facet";
  onChangeCategories: (
    target: "color" | "facet",
    categories: string[] | null
  ) => void;
}

// Says whether the list above it is the whole story, and opens the picker.
//
// Lives beside the legend and the facet panel rather than in the configuration
// column because those lists *are* the categories: "which of these get their
// own color" is a question you ask while looking at them. It also means the
// control has the plot response, which the picker needs — the statistics it
// shows are computed from the points already on screen, not fetched.
function ChooseCategoriesButton({
  data,
  plotConfig,
  target,
  onChangeCategories,
}: Props) {
  const { plotStyles } = useDataExplorerSettings();

  const mode =
    target === "facet"
      ? plotConfig?.facet_by
      : resolveColorMode(plotConfig ?? {}).mode;

  const catSlice = data ? findCategoricalSlice(data, mode, target) : null;
  const chosen = chosenCategoriesFor(plotConfig, target) ?? null;

  const handleClick = useCallback(async () => {
    if (!data || !catSlice) {
      return;
    }

    const values = catSlice.values as (string | null)[];
    const visible =
      data.filters?.visible?.values ?? new Array(values.length).fill(true);

    const axes = [data.dimensions?.x, data.dimensions?.y]
      .filter(Boolean)
      .map((dim) => dim!.values as (number | null)[])
      .filter((vals) => vals.some((v) => typeof v === "number"));

    const axisLabels = [
      data.dimensions?.x?.axis_label,
      data.dimensions?.y?.axis_label,
    ].filter(Boolean) as string[];

    const choice = await promptForCategories({
      values,
      axes,
      axisLabels,
      visible,
      chosen,
      noun: target === "facet" ? "facets" : "categories",
      // Facets degrade by getting small, which is legible; colors degrade by
      // repeating, which is not, so only color warns about a swatch limit.
      swatchLimit:
        target === "facet" ? null : plotStyles.palette.qualitativeMany.length,
    });

    // Canceled. Distinct from `{ categories: null }`, which is a deliberate
    // "restore default" and does need dispatching.
    if (!choice) {
      return;
    }

    onChangeCategories(target, choice.categories);
  }, [data, catSlice, chosen, target, plotStyles, onChangeCategories]);

  // An expansion-backed panel gets the members control instead: its members
  // decide what is fetched, not merely what is drawn, and they are edited
  // through a different field. Today this never fires — the expansion is capped
  // upstream, so nothing is ever collapsed here — but that is a property of the
  // cap rather than a rule, and a stray `color_categories` would surface both.
  if (!data || !catSlice || mode === "expansion") {
    return null;
  }

  const { shown, hasRemainder } = getShownCategories(
    catSlice.values as string[],
    data.dimensions as Record<string, { values: unknown[] }>,
    data.filters as Record<string, { values: boolean[] }>,
    SOFT_MAX_CATEGORIES,
    chosen
  );

  // Nothing was collapsed and nothing was chosen: the list above is complete,
  // and offering to trim it would invent a problem.
  if (!hasRemainder && !chosen) {
    return null;
  }

  return (
    <div className={styles.categoryPickerControl}>
      <div className={styles.categoryPickerSummary}>
        {chosen
          ? `Showing ${shown.size} you chose.`
          : `Showing ${shown.size} of these — the ones that stand out most on these axes.`}
      </div>
      <Button bsSize="xsmall" onClick={handleClick} bsStyle="info">
        Choose…
      </Button>
    </div>
  );
}

export default ChooseCategoriesButton;
