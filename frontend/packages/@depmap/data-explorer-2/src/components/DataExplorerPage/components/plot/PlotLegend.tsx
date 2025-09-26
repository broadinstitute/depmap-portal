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
  sortedLegendKeys,
  continuousBins,
  hiddenLegendValues,
  legendKeysWithNoData,
  onClickLegendItem,
  handleClickShowAll,
  handleClickHideAll,
}: any) {
  const { sectionHeights } = useContext(SectionStackContext);

  const categories = (
    sortedLegendKeys || Reflect.ownKeys(colorMap || {})
  ).filter(
    (category: any) =>
      data?.dimensions?.color ||
      !legendKeysWithNoData ||
      !legendKeysWithNoData.has(category)
  );

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
          <button type="button" onClick={() => handleClickHideAll(colorMap)}>
            Hide all
          </button>
        </div>
      )}
      {categories.map((category: any) => (
        <div key={category.toString()}>
          <button
            type="button"
            style={{
              opacity: hiddenLegendValues.has(category) ? 0.3 : 1.0,
            }}
            onClick={() => onClickLegendItem(category, colorMap)}
          >
            <span
              className={styles.legendSwatch}
              style={{ backgroundColor: colorMap[category] }}
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
    return (
      <div className={styles.colorDimensionLabels}>
        <div>{data.metadata.color_property.label}</div>
      </div>
    );
  }

  return null;
}

interface Props {
  data: DataExplorerPlotResponse | null;
  // TODO: Convert `colorMap` to a proper Map so that `sortedLegendKeys` is not
  // needed (objects aren't guaranteed to maintain the order of their keys and
  // do especially weird things with keys that are symbols).
  colorMap: Record<string | symbol, string>;
  sortedLegendKeys?: (string | symbol)[];
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
