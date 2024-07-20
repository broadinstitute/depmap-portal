import React, { useEffect, useState } from "react";
import cx from "classnames";
import {
  Alignments,
  CellignerSampleType,
  GroupingCategory,
} from "src/celligner/models/types";
import {
  getGroupByColorPalette,
  sampleTypeToLabel,
  useLegendCLickLogic,
} from "src/celligner/utilities/plot";

interface Props {
  alignments: Alignments;
  selectedPoints: Array<number>;
  selectedPrimarySite: string | null;
  colorByCategory: GroupingCategory;
  subsetLegendBySelectedLineages: boolean;
  onChange: (colorLegendPointVisibilty: boolean[]) => void;
}

function ColorLegend({
  alignments,
  selectedPoints,
  selectedPrimarySite,
  colorByCategory,
  subsetLegendBySelectedLineages,
  onChange,
}: Props) {
  const [legendKeys, setLegendKeys] = useState<Array<string | number>>([]);
  const [hiddenLegendKeys, setHiddenLegendKeys] = useState<
    Set<string | number>
  >(new Set());

  const { handleClick } = useLegendCLickLogic(legendKeys, setHiddenLegendKeys);

  useEffect(() => {
    let categoryArr = alignments[colorByCategory] as Array<number | string>;

    if (selectedPrimarySite) {
      categoryArr = categoryArr.filter(
        (_: unknown, i: number) => alignments.lineage[i] === selectedPrimarySite
      );
    }

    let keys: Array<number | string> =
      colorByCategory === "cluster"
        ? [...new Set(categoryArr as number[])].sort((a, b) => a - b)
        : [...new Set(categoryArr as string[])].sort();

    if (subsetLegendBySelectedLineages) {
      const selectedLineages = new Set(
        alignments.lineage.filter((lineage, i) => selectedPoints.includes(i))
      );
      keys = keys.filter((k) => selectedLineages.has(k as string));
    }

    setLegendKeys(keys);
    setHiddenLegendKeys(new Set());
  }, [
    alignments,
    colorByCategory,
    selectedPoints,
    selectedPrimarySite,
    subsetLegendBySelectedLineages,
  ]);

  useEffect(() => {
    const categoryArr = alignments[colorByCategory];
    const pointVisibility = categoryArr.map(
      (value) => !hiddenLegendKeys.has(value as string)
    );

    onChange(pointVisibility);
  }, [alignments, colorByCategory, onChange, hiddenLegendKeys]);

  const groupbyColorPalette = getGroupByColorPalette(alignments);

  const colors = new Map(
    groupbyColorPalette!
      .get(colorByCategory)!
      .map((v): [string | number, string] => [
        v.target as string,
        v.value.marker?.color as string,
      ])
  );

  return (
    <div className="celligner_graph_plotly_legend">
      {legendKeys.map((key) => (
        <button
          key={key}
          className={cx("celligner_legend_item", {
            "celligner_legend_item--toggled_off": hiddenLegendKeys.has(key),
          })}
          type="button"
          onClick={() => handleClick(key)}
        >
          <i className="fas fa-circle" style={{ color: colors.get(key) }} />
          <span className="celligner_graph_plotly_legend_label">
            {colorByCategory === "type"
              ? sampleTypeToLabel.get(key as CellignerSampleType)
              : key ?? "N/A"}
          </span>
        </button>
      ))}
    </div>
  );
}

export default ColorLegend;
