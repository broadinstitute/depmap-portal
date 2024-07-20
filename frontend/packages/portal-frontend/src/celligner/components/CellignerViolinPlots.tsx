import * as React from "react";
import * as Plotly from "plotly.js";

import { PlotHTMLElement } from "@depmap/plotly-wrapper";
import { arraysShallowlyEqual } from "src/common/utilities/helper_functions";
import { Tumor } from "src/celligner/models/types";

type Props = {
  show: boolean;
  tumors: Array<Tumor>;
  tumorDistances: Array<number>;
  mostCommonLineage: string | null;
};

const COLOR_PALETTE: Map<string, string> = new Map<string, string>([
  ["Testis", "#d1d684"],
  ["Pleura", "#dc882d"],
  ["Ampulla of Vater", "#dfbc3a"],
  ["Vulva/Vagina", "#c44c90"],
  ["CNS/Brain", "#f5899e"],
  ["Bone", "#9f55bb"],
  ["Pancreas", "#b644dc"],
  ["Soft Tissue", "#5fdb69"],
  ["Skin", "#6c55e2"],
  ["Liver", "#9c5e2b"],
  ["Myeloid", "#da45bb"],
  ["Lymphoid", "#abd23f"],
  ["Peripheral Nervous System", "#73e03d"],
  ["Ovary/Fallopian Tube", "#56e79d"],
  ["engineered_ovary", "#56e79d"],
  ["Adrenal Gland", "#e13978"],
  ["Esophagus/Stomach", "#5da134"],
  ["Kidney", "#1f8fff"],
  ["Eye", "#349077"],
  ["Head and Neck", "#a9e082"],
  ["Unknown", "#999999"],
  ["Other", "#999999"],
  ["Cervix", "#5ab172"],
  ["Thyroid", "#d74829"],
  ["Lung", "#51d5e0"],
  ["Bowel", "#96568e"],
  ["Biliary Tract", "#c091e3"],
  ["Penis", "#949031"],
  ["Thymus", "#659fd9"],
  ["Prostate", "#3870c9"],
  ["Uterus", "#e491c1"],
  ["Breast", "#45a132"],
  ["Bladder/Urinary Tract", "#e08571"],
]);

function buildPlot(
  plotElement: PlotHTMLElement,
  tumors: Array<any>,
  tumorDistances: Array<number>,
  mostCommonLineage: string | null
) {
  const lineages = tumors.map((tumor) =>
    tumor.lineage === mostCommonLineage ? mostCommonLineage : "other"
  );
  const data: Array<Partial<Plotly.Data & Plotly.ViolinData>> = [
    {
      type: "violin",
      x: lineages,
      y: tumorDistances,
      points: false,
      box: {
        visible: true,
      },
      meanline: {
        visible: true,
      },
      transforms: [
        {
          type: "groupby",
          groups: lineages as string[],
          styles: [
            {
              target: mostCommonLineage as string,
              value: {
                line: { color: COLOR_PALETTE.get(mostCommonLineage as string) },
              },
            },
            { target: "other", value: { line: { color: "gray" } } },
          ],
        },
      ],
    },
  ];

  const layout: Partial<Plotly.Layout> = {
    yaxis: {
      title: "Distance",
    },
    margin: {
      t: 20,
    },
    showlegend: false,
  };

  Plotly.newPlot(plotElement, data, layout, { responsive: true });
}

export default class CellignerViolinPlots extends React.Component<Props> {
  plotElement: PlotHTMLElement | null = null;

  componentDidUpdate(prevProps: Props) {
    const { show, tumorDistances, mostCommonLineage, tumors } = this.props;
    if (
      show &&
      (!arraysShallowlyEqual(prevProps.tumorDistances, tumorDistances) ||
        prevProps.mostCommonLineage !== mostCommonLineage)
    ) {
      buildPlot(
        this.plotElement as PlotHTMLElement,
        tumors,
        tumorDistances,
        mostCommonLineage
      );
    } else if (prevProps.show && !show) {
      Plotly.purge(this.plotElement as PlotHTMLElement);
    }
  }

  render() {
    return (
      <div
        id="celligner-violin-plot"
        ref={(element: HTMLElement | null) => {
          this.plotElement = element as PlotHTMLElement;
        }}
      />
    );
  }
}
