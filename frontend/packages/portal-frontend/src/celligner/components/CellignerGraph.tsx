import React from "react";
import Plotly, { Annotations } from "plotly.js";
import isEqual from "lodash.isequal";
import {
  buildPlot,
  calculateLabelPositions,
  getGroupByColorPalette,
  getSampleTypeTransform,
} from "src/celligner/utilities/plot";
import {
  Alignments,
  CellignerSampleType,
  GroupingCategory,
} from "src/celligner/models/types";
import CellLineTumorLegend from "src/celligner/components/CellLineTumorLegend";
import ColorLegend from "src/celligner/components/ColorLegend";
import PlotControls, {
  PlotToolOptions,
} from "src/plot/components/PlotControls";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { saveNewContext } from "src";

interface Props {
  alignments: Alignments;
  colorByCategory: GroupingCategory;
  selectedPrimarySite: string | null;
  selectedPoints: Array<number>;
  annotatedPoints: Partial<Annotations>[] | undefined;
  subsetLegendBySelectedLineages: boolean;

  // sidePanelSelectedPts and lassoOrBoxSelectedPts are used by CellignerGraph.tsx
  // to load points on the Make Context button click. These are separated into 2
  // variables, because there are 2 ways to select points, and only the lassOrSelectedPts
  // are deselectable via the "Deselect" PlotControls.tsx button.
  lassoOrBoxSelectedPoints: Set<number>;
  sidePanelSelectedPoints: Set<number>;
  handleUnselectTableRows: () => void;
  handleResetContextPtSelection: () => void;
  handleSelectingContextPts: (pointIndexes: number[]) => void;
  handleDeselectContextPts: () => void;
}

interface State {
  pointSize: {
    CL: number;
    tumor: number;
  };
  tumorLegendPointVisibilty: boolean[];
  colorLegendPointVisibilty: boolean[];
}

export default class CellignerGraph extends React.Component<Props, State> {
  labelPositions: Array<Partial<Plotly.Annotations>>;

  plotElement: ExtendedPlotType | null = null;

  plotLayout: Plotly.PlotRelayoutEvent = {
    dragmode: "zoom",
    "xaxis.autorange": true,
    "xaxis.range[0]": 0,
    "xaxis.range[1]": 0,
    "yaxis.autorange": true,
    "yaxis.range[0]": 0,
    "yaxis.range[1]": 0,
  };

  constructor(props: Props) {
    super(props);

    const { alignments } = this.props;

    this.state = {
      pointSize: {
        CL: 8,
        tumor: 4,
      },
      tumorLegendPointVisibilty: [],
      colorLegendPointVisibilty: [],
    };

    this.onPlotRelayout = this.onPlotRelayout.bind(this);

    this.labelPositions = calculateLabelPositions(alignments);
  }

  componentDidMount() {
    const {
      alignments,
      annotatedPoints,
      selectedPoints,
      colorByCategory,
      lassoOrBoxSelectedPoints,
      sidePanelSelectedPoints,
      handleResetContextPtSelection,
      handleSelectingContextPts,
      handleUnselectTableRows,
    } = this.props;
    const { pointSize } = this.state;
    const groupbyColorPalette = getGroupByColorPalette(alignments);

    buildPlot(
      this.plotElement as ExtendedPlotType,
      alignments,
      selectedPoints,
      annotatedPoints,
      this.labelPositions,
      alignments[colorByCategory] as any,
      groupbyColorPalette.get(colorByCategory) as any,
      pointSize.CL,
      pointSize.tumor,
      new Set([...lassoOrBoxSelectedPoints, ...sidePanelSelectedPoints]),
      handleUnselectTableRows,
      handleSelectingContextPts,
      handleResetContextPtSelection
    );

    this.plotElement!.on("plotly_relayout", this.onPlotRelayout);
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const {
      alignments,
      selectedPoints,
      annotatedPoints,
      colorByCategory,
      lassoOrBoxSelectedPoints,
    } = this.props;
    const {
      tumorLegendPointVisibilty,
      colorLegendPointVisibilty,
      pointSize,
    } = this.state;

    const restyles: Partial<Plotly.Data> = {};
    const relayout: Partial<Plotly.Layout> = {};

    if (
      prevProps.alignments !== alignments ||
      prevProps.colorByCategory !== colorByCategory ||
      prevState.pointSize !== pointSize ||
      prevState.tumorLegendPointVisibilty !== tumorLegendPointVisibilty ||
      prevState.colorLegendPointVisibilty !== colorLegendPointVisibilty ||
      prevProps.lassoOrBoxSelectedPoints !== lassoOrBoxSelectedPoints ||
      prevProps.annotatedPoints !== annotatedPoints
    ) {
      const groups = (alignments[colorByCategory] as any).map(
        (c: any) => c ?? "N/A"
      );

      const pointVisibility = alignments.lineage.map(
        (_, i) => tumorLegendPointVisibilty[i] && colorLegendPointVisibilty[i]
      );

      const groupbyColorPalette = getGroupByColorPalette(alignments);

      (restyles as any).transforms = [
        [
          getSampleTypeTransform(alignments, pointSize.CL, pointSize.tumor),
          {
            type: "groupby",
            groups,
            styles: groupbyColorPalette.get(colorByCategory),
          },
          {
            type: "filter",
            target: pointVisibility,
            operation: "=",
            value: true,
          },
        ],
      ];
    }
    if (!isEqual(prevProps.selectedPoints, selectedPoints)) {
      (restyles as any).selectedpoints = [selectedPoints];
    }

    // Important for when the user clicks the new PlotControls "Deselect" option
    if (
      !isEqual(prevProps.lassoOrBoxSelectedPoints, lassoOrBoxSelectedPoints) &&
      prevProps.lassoOrBoxSelectedPoints.size > 0 &&
      lassoOrBoxSelectedPoints.size === 0
    ) {
      (restyles as any).selectedPointIndexes = lassoOrBoxSelectedPoints;
      (restyles as any).selectedpoints = [selectedPoints];
    }
    if (!isEqual(prevProps.annotatedPoints, annotatedPoints)) {
      (relayout as any).annotations = annotatedPoints
        ? this.labelPositions?.concat(annotatedPoints)
        : this.labelPositions;

      Plotly.relayout(this.plotElement!, relayout);
    }

    Plotly.restyle(this.plotElement!, restyles);
  }

  onPlotRelayout(e: Partial<Plotly.PlotRelayoutEvent>) {
    const { pointSize } = this.state;

    const newPlotlyLayout: Plotly.PlotRelayoutEvent = {
      ...this.plotLayout,
      ...e,
    };

    let newPointSize = pointSize;
    if (newPlotlyLayout.dragmode !== this.plotLayout.dragmode) {
      // do nothing
    } else if (
      (newPlotlyLayout["xaxis.autorange"] === true &&
        this.plotLayout["xaxis.autorange"] === false) ||
      (newPlotlyLayout["yaxis.autorange"] === true &&
        this.plotLayout["yaxis.autorange"] === false)
    ) {
      newPointSize = { CL: 8, tumor: 4 };
    } else if (
      newPlotlyLayout["xaxis.range[0]"] !== this.plotLayout["xaxis.range[0]"] ||
      newPlotlyLayout["xaxis.range[1]"] !== this.plotLayout["xaxis.range[1]"] ||
      newPlotlyLayout["yaxis.range[0]"] !== this.plotLayout["yaxis.range[0]"] ||
      newPlotlyLayout["yaxis.range[1]"] !== this.plotLayout["yaxis.range[1]"]
    ) {
      if (
        newPlotlyLayout["xaxis.range[0]"] !==
          this.plotLayout["xaxis.range[0]"] ||
        newPlotlyLayout["xaxis.range[1]"] !== this.plotLayout["xaxis.range[1]"]
      ) {
        newPlotlyLayout["xaxis.autorange"] = false;
      }
      if (
        newPlotlyLayout["yaxis.range[0]"] !==
          this.plotLayout["yaxis.range[0]"] ||
        newPlotlyLayout["yaxis.range[1]"] !== this.plotLayout["yaxis.range[1]"]
      ) {
        newPlotlyLayout["yaxis.autorange"] = false;
      }

      const plotWidth =
        newPlotlyLayout["xaxis.range[1]"]! - newPlotlyLayout["xaxis.range[0]"]!;
      const plotHeight =
        newPlotlyLayout["yaxis.range[1]"]! - newPlotlyLayout["yaxis.range[0]"]!;

      if (plotWidth < 10 && plotHeight < 10) {
        newPointSize = { CL: 16, tumor: 10 };
      }
    }

    this.plotLayout = newPlotlyLayout;
    this.setState({ pointSize: newPointSize });
  }

  handleChangeTumorLegend = (tumorLegendPointVisibilty: boolean[]) => {
    this.setState({ tumorLegendPointVisibilty });
  };

  handleChangeColorLegend = (colorLegendPointVisibilty: boolean[]) => {
    this.setState({
      colorLegendPointVisibilty,
    });
  };

  onMakeContextButtonClick = async () => {
    const {
      alignments,
      lassoOrBoxSelectedPoints,
      sidePanelSelectedPoints,
    } = this.props;
    const { tumorLegendPointVisibilty, colorLegendPointVisibilty } = this.state;

    const pointVisibility = alignments.lineage.map(
      (_, i) => tumorLegendPointVisibilty[i] && colorLegendPointVisibilty[i]
    );

    const intersectionOfSelectionMethods = [
      ...sidePanelSelectedPoints,
    ].filter((value) => [...lassoOrBoxSelectedPoints].includes(value));

    const selectedPtsForContext = new Set([...intersectionOfSelectionMethods]);

    const selectedModelIds = alignments.sampleId.filter(
      (_, index) =>
        alignments.type[index] === CellignerSampleType.DEPMAP_MODEL &&
        selectedPtsForContext.has(index) &&
        pointVisibility[index] === true
    );

    const exp = { in: [{ var: "entity_label" }, selectedModelIds] };

    const context = {
      name: "",
      context_type: "depmap_model",
      expr: exp,
    };

    saveNewContext(context);
  };

  getPlotControlEnabledTools = () => {
    if (this.props.lassoOrBoxSelectedPoints.size > 0) {
      return [
        PlotToolOptions.Zoom,
        PlotToolOptions.Pan,
        PlotToolOptions.Lasso,
        PlotToolOptions.Select,
        PlotToolOptions.Deselect,
        PlotToolOptions.MakeContext,
        PlotToolOptions.UnselectAnnotatedPoints,
      ];
    }

    if (this.props.sidePanelSelectedPoints.size > 0) {
      return [
        PlotToolOptions.Zoom,
        PlotToolOptions.Pan,
        PlotToolOptions.Lasso,
        PlotToolOptions.Select,
        PlotToolOptions.MakeContext,
        PlotToolOptions.UnselectAnnotatedPoints,
      ];
    }

    return [
      PlotToolOptions.Zoom,
      PlotToolOptions.Pan,
      PlotToolOptions.Lasso,
      PlotToolOptions.Select,
      PlotToolOptions.UnselectAnnotatedPoints,
    ];
  };

  render() {
    return (
      <div className="graph_container">
        <div className="celligner_plot_controls">
          <PlotControls
            plot={this.plotElement as ExtendedPlotType}
            enabledTools={this.getPlotControlEnabledTools()}
            searchOptions={[]}
            searchPlaceholder=""
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            onSearch={() => {
              /* do nothing */
            }}
            onDownload={() => {
              /* do nothing */
            }}
            onMakeContext={this.onMakeContextButtonClick}
            onDeselectPoints={this.props.handleDeselectContextPts}
          />
        </div>
        <div className="celligner_graph_container">
          <div
            id="celligner_plotly_plot"
            ref={(element: HTMLElement | null) => {
              this.plotElement = element as ExtendedPlotType | null;
            }}
          />
          <div className="celligner_graph_plotly_legend_container">
            <CellLineTumorLegend
              alignments={this.props.alignments}
              onChange={this.handleChangeTumorLegend}
            />
            <ColorLegend
              alignments={this.props.alignments}
              selectedPoints={this.props.selectedPoints}
              selectedPrimarySite={this.props.selectedPrimarySite}
              colorByCategory={this.props.colorByCategory}
              subsetLegendBySelectedLineages={
                this.props.subsetLegendBySelectedLineages
              }
              onChange={this.handleChangeColorLegend}
            />
          </div>
        </div>
      </div>
    );
  }
}
