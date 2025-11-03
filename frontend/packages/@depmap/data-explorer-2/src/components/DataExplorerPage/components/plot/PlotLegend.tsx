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
  legendKeysWithNoData,
  onClickLegendItem,
  handleClickShowAll,
  handleClickHideAll,
}: {
  data: any;
  colorMap: Map<LegendKey, string>;
  sortedLegendKeys?: LegendKey[];
  continuousBins: any;
  hiddenLegendValues: any;
  legendKeysWithNoData: Set<LegendKey> | null;
  onClickLegendItem: any;
  handleClickShowAll: any;
  handleClickHideAll: any;
}) {
  const { sectionHeights } = useContext(SectionStackContext);

  const categories = (sortedLegendKeys || [...colorMap.keys()]).filter(
    (category) =>
      data?.dimensions?.color ||
      !legendKeysWithNoData ||
      !legendKeysWithNoData.has(category)
  );

  // TODO: Update callbacks to use `colorMap` directly.
  const colorMapAsObject = Object.fromEntries(colorMap);

  const hasColorDimensionLabels = Boolean(data?.dimensions?.color);
  const extraTextHeight = hasColorDimensionLabels ? 40 : 0;
  const maxHeight = sectionHeights[0] - HEIGHT_WITHOUT_LIST - extraTextHeight;

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
            />
          </button>
        </div>
      ))}
    </div>
  );
}

function SliceDescription({ data }: { data: DataExplorerPlotResponse | null }) {
  if (data?.dimensions?.color) {
    return (
      <div className={styles.colorDimensionLabels}>
        <div>{data.dimensions.color.axis_label}</div>
        <div>{data.dimensions.color.dataset_label}</div>
      </div>
    );
  }

  if (data?.metadata?.color_property) {
    const { label, units, dataset_label } = data.metadata.color_property;

    return (
      <div className={styles.colorDimensionLabels}>
        <div>{label}</div>
        {units && <div>{units}</div>}
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
  legendKeysWithNoData: Set<LegendKey> | null;
  onClickLegendItem: (
    item: string | symbol,
    catColorMap: Record<string, string>
  ) => void;
  handleClickShowAll: () => void;
  handleClickHideAll: (catColorMap: Record<string, string>) => void;
}

function PlotLegend({
  data,
  colorMap,
  sortedLegendKeys = undefined,
  continuousBins,
  hiddenLegendValues,
  legendKeysWithNoData,
  onClickLegendItem,
  handleClickShowAll,
  handleClickHideAll,
}: Props) {
  return (
    <div>
      <div className={styles.plotInstructions}>
        Click to toggle on/off
        <HelpTip id="legend-doubleclick-help" />
      </div>
      <SliceDescription data={data} />
      <LegendLabels
        data={data}
        colorMap={colorMap}
        sortedLegendKeys={sortedLegendKeys}
        continuousBins={continuousBins}
        hiddenLegendValues={hiddenLegendValues}
        legendKeysWithNoData={legendKeysWithNoData}
        onClickLegendItem={onClickLegendItem}
        handleClickShowAll={handleClickShowAll}
        handleClickHideAll={handleClickHideAll}
      />
    </div>
  );
}

export default PlotLegend;
