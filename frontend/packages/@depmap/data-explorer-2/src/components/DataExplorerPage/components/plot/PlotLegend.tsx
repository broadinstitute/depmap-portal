import React, { useContext } from "react";
import { DataExplorerPlotResponse } from "@depmap/types";
import { SectionStackContext } from "../SectionStack";
import HelpTip from "../HelpTip";
import LegendLabel from "./LegendLabel";
import type { ContinuousBins, LegendKey } from "./prototype/plotUtils";
import styles from "../../styles/DataExplorer2.scss";

const HEIGHT_WITHOUT_LIST = 54;

function LegendLabels({
  data,
  colorMap,
  sortedLegendKeys = undefined,
  continuousBins,
  hiddenLegendValues,
  onClickLegendItem,
  handleClickShowAll,
  handleClickHideAll,
  target,
}: {
  data: any;
  colorMap: Map<LegendKey, string>;
  sortedLegendKeys?: LegendKey[];
  continuousBins: any;
  hiddenLegendValues: any;
  onClickLegendItem: any;
  handleClickShowAll: any;
  handleClickHideAll: any;
  target: "color" | "facet";
}) {
  const { sectionHeights } = useContext(SectionStackContext);

  // No-data keys are deliberately NOT filtered out of this list: they seed
  // hiddenLegendValues (see useLegendState's legendKeysWithNoData param), so
  // they render toggled off (dimmed) — the same treatment every no-data item
  // gets regardless of which triad backs the legend. (They used to be
  // display-filtered here unless the target was backed by a real response
  // dimension, which made no-data items vanish entirely for
  // property/expansion-backed legends.)
  const categories = sortedLegendKeys || [...colorMap.keys()];

  // TODO: Update callbacks to use `colorMap` directly.
  const colorMapAsObject = Object.fromEntries(colorMap);

  const hasColorDimensionLabels = Boolean(data?.dimensions?.[target]);
  const extraTextHeight = hasColorDimensionLabels ? 40 : 0;
  const maxHeight =
    sectionHeights.Legend - HEIGHT_WITHOUT_LIST - extraTextHeight;

  return (
    <div className={styles.LegendLabels} style={{ maxHeight }} data-overflow>
      {categories && categories.length > 1 && (
        <div className={styles.legendHideAllShowAllButtons}>
          <button type="button" onClick={() => handleClickShowAll()}>
            Show all
          </button>
          <span> | </span>
          <button
            type="button"
            onClick={() => handleClickHideAll(colorMapAsObject)}
          >
            Hide all
          </button>
        </div>
      )}
      {categories.map((category) => (
        <div key={category.toString()}>
          <button
            type="button"
            style={{
              opacity: hiddenLegendValues.has(category) ? 0.3 : 1.0,
            }}
            onClick={() => onClickLegendItem(category, colorMapAsObject)}
          >
            <span
              className={styles.legendSwatch}
              style={{ backgroundColor: colorMap.get(category) }}
            />
            <LegendLabel
              data={data}
              continuousBins={continuousBins}
              category={category}
              target={target}
            />
          </button>
        </div>
      ))}
    </div>
  );
}

function SliceDescription({
  data,
  target,
}: {
  data: DataExplorerPlotResponse | null;
  target: "color" | "facet";
}) {
  const dimension = data?.dimensions?.[target];
  if (dimension) {
    return (
      <div className={styles.colorDimensionLabels}>
        <div>{dimension.axis_label}</div>
        <div>{dimension.dataset_label}</div>
      </div>
    );
  }

  const property = data?.metadata?.[`${target}_property`];
  if (property) {
    const { label, units, dataset_label } = property;

    return (
      <div className={styles.colorDimensionLabels}>
        <div>{label}</div>
        {units && units !== "unitless" && <div>{units}</div>}
        {dataset_label && <div>{dataset_label}</div>}
      </div>
    );
  }

  return null;
}

interface Props {
  data: DataExplorerPlotResponse | null;
  colorMap: Map<LegendKey, string>;
  sortedLegendKeys?: LegendKey[];
  continuousBins: ContinuousBins;
  hiddenLegendValues: Set<LegendKey>;
  onClickLegendItem: (
    item: string | symbol,
    catColorMap: Record<string, string>
  ) => void;
  handleClickShowAll: () => void;
  handleClickHideAll: (catColorMap: Record<string, string>) => void;
  // Which triad (color's own, or facet's own via the version-2 default
  // defer) backs this legend — see resolveColorMode. No default: an absent
  // color_by defers to facet_by, so "color" is not a safe universal
  // fallback here.
  target: "color" | "facet";
}

function PlotLegend({
  data,
  colorMap,
  sortedLegendKeys = undefined,
  continuousBins,
  hiddenLegendValues,
  onClickLegendItem,
  handleClickShowAll,
  handleClickHideAll,
  target,
}: Props) {
  return (
    <div>
      <div className={styles.plotInstructions}>
        Click to toggle on/off
        <HelpTip id="legend-doubleclick-help" />
      </div>
      <SliceDescription data={data} target={target} />
      <LegendLabels
        data={data}
        colorMap={colorMap}
        sortedLegendKeys={sortedLegendKeys}
        continuousBins={continuousBins}
        hiddenLegendValues={hiddenLegendValues}
        onClickLegendItem={onClickLegendItem}
        handleClickShowAll={handleClickShowAll}
        handleClickHideAll={handleClickHideAll}
        target={target}
      />
    </div>
  );
}

export default PlotLegend;
