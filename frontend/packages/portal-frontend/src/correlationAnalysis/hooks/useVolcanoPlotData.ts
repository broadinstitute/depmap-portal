import { useMemo } from "react";
import {
  SortedCorrelations,
  VolcanoDataForCorrelatedDataset,
} from "../models/CorrelationPlot";
import { formatDoseString } from "../utilities/helper";

export function useVolcanoPlotData(
  data: SortedCorrelations[],
  doseColors: { dose: string; hex: string | undefined }[],
  featureType: "gene" | "compound",
  selectedDatasetGivenId: string
) {
  return useMemo(() => {
    const isGene = featureType === "gene";
    const geneColor =
      selectedDatasetGivenId === "Chronos_Combined" ? "#337ab7" : "#532e8c";
    return data.reduce((acc: VolcanoDataForCorrelatedDataset, cur) => {
      const key = cur.featureDataset;
      if (!acc[key]) acc[key] = {};

      const cat = isGene ? "Correlation" : cur.dose;
      if (!cat) return acc;

      if (!acc[key][cat]) {
        acc[key][cat] = {
          x: [],
          y: [],
          label: [],
          text: [],
          isSignificant: [],
          name: cat,
          color: isGene
            ? geneColor
            : doseColors.find((d) => d.dose === cat)?.hex,
        };
      }

      const { x, y, text, label } = acc[key][cat];
      x.push(cur.correlation);
      y.push(-cur.log10qvalue);
      label.push(cur.feature);

      let tooltip = `<b>${cur.feature}</b><br>`;
      if (!isGene) {
        tooltip += `<b>Dose (uM)</b>: ${formatDoseString(cur.dose)}<br>`;
      }
      tooltip += `<b>Corr:</b> ${cur.correlation.toFixed(
        4
      )}<br><b>-log10(q):</b> ${cur.log10qvalue.toFixed(4)}`;
      text.push(tooltip);

      return acc;
    }, {});
  }, [data, doseColors, featureType, selectedDatasetGivenId]);
}
