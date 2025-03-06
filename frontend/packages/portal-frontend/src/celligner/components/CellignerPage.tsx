import * as React from "react";
import { Grid, Row, Col, Tabs, Tab, SelectCallback } from "react-bootstrap";

import { enabledFeatures } from "@depmap/globals";
import { DepmapApi } from "src/dAPI";
import { getDapi } from "src/common/utilities/context";
import WideTable, { WideTableColumns } from "@depmap/wide-table";
import { titleCase } from "@depmap/utils";
import CellignerCellLinesForTumorsControlPanel from "./CellignerCellLinesForTumorsControlPanel";
import CellignerTumorsForCellLineControlPanel from "./CellignerTumorsForCellLineControlPanel";
import CellignerGraph from "./CellignerGraph";
import CellignerViolinPlot from "./CellignerViolinPlots";
import { Alignments, Model, Tumor, GroupingCategory } from "../models/types";
import "src/celligner/styles/celligner.scss";
import { CustomList } from "@depmap/cell-line-selector";
import {
  createFormattedAnnotatedPoints,
  sampleTypeToLabel,
} from "src/celligner/utilities/plot";

function datasetFormatterCell(row: any) {
  return sampleTypeToLabel.get(row.value);
}

function distanceFormatterCell(row: any) {
  return (row.value && row.value.toFixed(3)) || "";
}

const NAME_FOR_MODEL = !enabledFeatures.celligner_app_v3
  ? "cell line"
  : "model";

const COMMON_TABLE_COLUMNS: Array<WideTableColumns> = [
  {
    Header: "Distance",
    accessor: "distance",
    columnDropdownLabel: "Distance",
    Cell: distanceFormatterCell,
    helperText: `Distance between a ${NAME_FOR_MODEL} and a tumor type is calculated by taking the median euclidean distance in 70 principal component space between that ${NAME_FOR_MODEL} and all tumors samples of that type.`,
  },
  {
    Header: "Lineage",
    accessor: "lineage",
    columnDropdownLabel: "Lineage",
  },
  {
    Header: "Subtype",
    accessor: "subtype",
    columnDropdownLabel: "Subtype",
  },
];

if (enabledFeatures.celligner_app_v3) {
  COMMON_TABLE_COLUMNS.splice(0, 0, {
    Header: "Sample Type",
    accessor: "type",
    columnDropdownLabel: "Sample Type",
    Cell: datasetFormatterCell,
  });
}

export type Props = {
  alignmentsArr: Alignments;
  models: Array<Model>;
  tumors: Array<Tumor>;
  subtypes: ReadonlyMap<string, Array<string>>;
  cellLineUrl: string;
  downloadUrl: string;
  methodologyUrl: string;
};

type ValidTab = "cell-line-for-tumors" | "tumors-for-cell-line";
type State = {
  activeTab: ValidTab;
  colorByCategory: GroupingCategory;
  selectedPrimarySite: string | null;
  selectedPoints: Array<number>;
  annotatedPoints: Set<number>;
  tumorDistances: Array<number> | null;
  cellLineDistances: Array<number> | null;
  mostCommonLineage: string | null;
  cellLineList: CustomList | null;

  // sidePanelSelectedPts and lassoOrBoxSelectedPts are used by CellignerGraph.tsx
  // to load points on the Make Context button click. These are separated into 2 state
  // variables, because there are 2 ways to select points, and only the lassOrSelectedPts
  // are deselectable via the "Deselect" PlotControls.tsx button.
  sidePanelSelectedPts: Set<number>;
  lassoOrBoxSelectedPts: Set<number>;
};
const ExplanationText = (props: {
  dapi: DepmapApi;
  methodologyUrl: string;
}) => {
  const { dapi, methodologyUrl } = props;
  return (
    <>
      {methodologyUrl && (
        <div>
          <a
            href={methodologyUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="icon-button-link"
          >
            <img
              src={dapi._getFileUrl("/static/img/predictability/pdf.svg")}
              alt=""
              className="icon"
            />
            <span>Methodology</span>
          </a>
        </div>
      )}
      <p>
        Celligner is intended to help researchers select {NAME_FOR_MODEL}s that
        most closely resemble a tumor type of interest. The method is based on
        an unsupervised approach that corrects for differences when integrating
        the CCLE and tumor expression datasets (TCGA, Treehouse, and TARGET). To
        learn more,{" "}
        <a
          href="https://doi.org/10.1038/s41467-020-20294-x"
          target="_blank"
          rel="noreferrer noopener"
        >
          see the article
        </a>
        .
      </p>
    </>
  );
};

function createAlignmentsWithCellLineSet(
  alignmentsArr: Alignments,
  cellLineList: CustomList | null
): Alignments {
  // make a copy of the structure
  const alignments = { ...alignmentsArr };

  // and compute the value of alignments.cellLineSet

  const cellLineSet = new Set(cellLineList ? cellLineList.lines : []);
  const name = cellLineList ? cellLineList.name : "";
  alignments.cellLineSet = alignments.sampleId.map((value) =>
    cellLineSet.has(value) ? name : "other"
  );

  return alignments;
}

export default class CellignerPage extends React.Component<Props, State> {
  dapi: DepmapApi;

  // data munging
  lineages: Array<string>;

  constructor(props: Props) {
    super(props);

    this.state = {
      activeTab: "cell-line-for-tumors",
      colorByCategory: "lineage",
      selectedPrimarySite: null,
      selectedPoints: props.alignmentsArr.cluster.map((_, i) => i),
      annotatedPoints: new Set<number>([]),
      tumorDistances: null,
      cellLineDistances: null,
      mostCommonLineage: null,
      cellLineList: null,
      sidePanelSelectedPts: new Set<number>([]),
      lassoOrBoxSelectedPts: new Set<number>([]),
    };

    this.dapi = getDapi();

    // data munging
    this.lineages = Array.from(props.subtypes.keys()).sort();

    // bind functions
    this.handleSelectTab = this.handleSelectTab.bind(this);
    this.handleSelectedPrimarySitesChange = this.handleSelectedPrimarySitesChange.bind(
      this
    );
    this.handleSelectedSubtypeChange = this.handleSelectedSubtypeChange.bind(
      this
    );
    this.handleColorByCategoryChange = this.handleColorByCategoryChange.bind(
      this
    );
    this.handleCellLineSelected = this.handleCellLineSelected.bind(this);
    this.handleCellLineListChange = this.handleCellLineListChange.bind(this);
  }

  handleSelectTab(activeTab: ValidTab) {
    const { alignmentsArr } = this.props;

    if (activeTab === "cell-line-for-tumors") {
      this.setState({
        activeTab,
        selectedPoints: alignmentsArr.cluster.map((_, i) => i),
        tumorDistances: null,
        mostCommonLineage: null,
        sidePanelSelectedPts: new Set([]),
        lassoOrBoxSelectedPts: new Set([]),
        annotatedPoints: new Set<number>([]),
      });
    } else {
      this.setState({
        activeTab,
        selectedPoints: alignmentsArr.cluster.map((_, i) => i),
        sidePanelSelectedPts: new Set([]),
        lassoOrBoxSelectedPts: new Set([]),
        annotatedPoints: new Set<number>([]),
        selectedPrimarySite: null,
        cellLineDistances: null,
        colorByCategory: "lineage",
      });
    }
  }

  handleSelectedPrimarySitesChange(selectedPrimarySite: string | null) {
    const { alignmentsArr, subtypes } = this.props;

    const selectedPoints: Array<number> = [];
    alignmentsArr.lineage.forEach((lineage, i) => {
      if (lineage === selectedPrimarySite) {
        selectedPoints.push(i);
      } else if (!selectedPrimarySite) {
        selectedPoints.push(i);
      }
    });

    this.setState(
      {
        selectedPrimarySite,
        selectedPoints,
        sidePanelSelectedPts:
          selectedPoints.length < alignmentsArr.lineage.length
            ? new Set(selectedPoints)
            : new Set([]),
        lassoOrBoxSelectedPts: new Set([]),
        cellLineDistances: null,
        colorByCategory: selectedPrimarySite ? "subtype" : "lineage",
      },
      () => {
        if (selectedPrimarySite) {
          const subtypeOptions = subtypes.get(selectedPrimarySite);
          if (subtypeOptions?.length === 1 && subtypeOptions[0] === "all") {
            this.handleSelectedSubtypeChange("all");
          }
        }
      }
    );
  }

  handleSelectedSubtypeChange(selectedSubtype: string) {
    const { selectedPrimarySite } = this.state;

    this.dapi
      .getCellignerDistancesToTumors(
        selectedPrimarySite as string,
        selectedSubtype
      )
      .then(
        (response: { medianDistances: Array<number> }) => {
          this.setState({
            cellLineDistances: response.medianDistances,
          });
        },
        (reason: any) => {
          this.setState({ cellLineDistances: null });
          console.log(reason);
        }
      );
  }

  handleColorByCategoryChange(colorByCategory: GroupingCategory) {
    this.setState({ colorByCategory });
  }

  handleCellLineListChange(cellLineList: CustomList) {
    this.setState({ cellLineList });
  }

  handleCellLineSelected(selectedSampleId: string, kNeighbors: number) {
    const { alignmentsArr } = this.props;

    const cellLineIndex = alignmentsArr.sampleId.findIndex(
      (sampleId) => sampleId === selectedSampleId
    );
    this.dapi
      .getCellignerDistancesToCellLine(selectedSampleId, kNeighbors)
      .then((e) => {
        this.setState({
          tumorDistances: e.distance_to_tumors,
          mostCommonLineage: e.most_common_lineage,
          selectedPoints: e.color_indexes.concat([cellLineIndex]),
          sidePanelSelectedPts: new Set<number>(
            e.color_indexes.concat([cellLineIndex])
          ),
          lassoOrBoxSelectedPts: new Set([]),
        });
      })
      .catch((e) => console.log("error", e));
  }

  renderControlPanel() {
    const {
      models,

      subtypes,
    } = this.props;

    const { activeTab, colorByCategory, selectedPrimarySite } = this.state;

    if (activeTab === "cell-line-for-tumors") {
      return (
        <CellignerCellLinesForTumorsControlPanel
          selectedPrimarySite={selectedPrimarySite}
          onSelectedPrimarySitesChange={this.handleSelectedPrimarySitesChange}
          subtypes={subtypes}
          colorByCategory={colorByCategory}
          onColorByCategoryChange={this.handleColorByCategoryChange}
          onSubtypeSelected={this.handleSelectedSubtypeChange}
          onCellLineListChange={this.handleCellLineListChange}
        />
      );
    }
    if (activeTab === "tumors-for-cell-line") {
      return (
        <CellignerTumorsForCellLineControlPanel
          cellLines={models}
          onCellLineSelected={this.handleCellLineSelected}
        />
      );
    }
    return null;
  }

  renderGraph() {
    const { alignmentsArr } = this.props;

    const {
      colorByCategory,
      tumorDistances,
      selectedPoints,
      annotatedPoints,
      selectedPrimarySite,
      cellLineList,
      sidePanelSelectedPts,
      lassoOrBoxSelectedPts,
    } = this.state;

    const formattedAnnotatedPoints = createFormattedAnnotatedPoints(
      annotatedPoints,
      alignmentsArr
    );

    const alignmentsArrWithCellLineCol = createAlignmentsWithCellLineSet(
      alignmentsArr,
      cellLineList
    );

    const handleResetContextPtSelection = () => {
      this.setState({
        lassoOrBoxSelectedPts: new Set<number>([]),
      });
    };

    const handleSelectingContextPts = (pointIndexes: number[]) => {
      const out: Set<number> = new Set();

      if (!alignmentsArrWithCellLineCol) {
        return out;
      }

      for (let index = 0; index < pointIndexes.length; index++) {
        const pointIndex = pointIndexes[index];
        if (!lassoOrBoxSelectedPts?.has(pointIndex)) {
          out.add(pointIndex);
        }
      }

      return this.setState({ lassoOrBoxSelectedPts: out });
    };

    const handleDeselectLassoOrBoxPts = () => {
      this.setState({
        lassoOrBoxSelectedPts: new Set([]),
      });
    };

    const handleUnselectTableRows = () => {
      this.setState({ annotatedPoints: new Set([]) });
    };

    return (
      <CellignerGraph
        alignments={alignmentsArrWithCellLineCol}
        colorByCategory={colorByCategory}
        selectedPrimarySite={selectedPrimarySite}
        selectedPoints={selectedPoints}
        annotatedPoints={formattedAnnotatedPoints}
        lassoOrBoxSelectedPoints={lassoOrBoxSelectedPts}
        sidePanelSelectedPoints={sidePanelSelectedPts}
        subsetLegendBySelectedLineages={!!tumorDistances}
        handleUnselectTableRows={handleUnselectTableRows}
        handleResetContextPtSelection={handleResetContextPtSelection}
        handleSelectingContextPts={handleSelectingContextPts}
        handleDeselectContextPts={handleDeselectLassoOrBoxPts}
      />
    );
  }

  renderViolinPlot() {
    const { tumors } = this.props;

    const { activeTab, tumorDistances, mostCommonLineage } = this.state;
    const hideViolinPlots =
      activeTab === "cell-line-for-tumors" ||
      !tumorDistances ||
      !mostCommonLineage;

    return (
      <CellignerViolinPlot
        show={!hideViolinPlots}
        tumors={tumors}
        tumorDistances={tumorDistances || []}
        mostCommonLineage={mostCommonLineage}
      />
    );
  }

  renderTable() {
    const {
      models,
      tumors,
      downloadUrl,
      cellLineUrl,
      alignmentsArr,
    } = this.props;

    const {
      activeTab,
      tumorDistances,
      cellLineDistances,
      annotatedPoints,
      lassoOrBoxSelectedPts,
      sidePanelSelectedPts,
    } = this.state;

    const handleChangeCellLineTableSelections = (selections: string[]) => {
      const selectedIndexes = selections.map((selectedDisplayName: string) =>
        alignmentsArr.displayName.findIndex(
          (displayName) => displayName === selectedDisplayName
        )
      );

      const out: Set<number> = new Set();

      if (!alignmentsArr) {
        return out;
      }

      return this.setState({ annotatedPoints: new Set(selectedIndexes) });
    };

    const renderCellLineLink = ({ row }: any) => {
      const { original } = row;
      return original.modelLoaded ? (
        <a
          href={`${cellLineUrl}${original.sampleId}`}
          target="_blank"
          rel="noreferrer"
        >
          {original.displayName}
        </a>
      ) : (
        original.displayName
      );
    };

    if (activeTab === "cell-line-for-tumors") {
      const cellLinesForTumorsColumns: Array<WideTableColumns> = ([
        {
          Header: `${titleCase(NAME_FOR_MODEL)} Name`,
          accessor: "displayName",
          columnDropdownLabel: `${titleCase(NAME_FOR_MODEL)} Name`,
          Cell: renderCellLineLink,
        },
      ] as Array<WideTableColumns>).concat(COMMON_TABLE_COLUMNS);

      return (
        // Div height chosen to fit in single page?
        <div style={{ height: 400 }}>
          {/* Shorter div height so table not as long as page and defined border */}
          <div style={{ height: 380 }}>
            <WideTable
              key={activeTab}
              idProp={"displayName"}
              onChangeSelections={handleChangeCellLineTableSelections}
              data={
                cellLineDistances
                  ? models
                      .map((cellLine, i) => {
                        return {
                          ...cellLine,
                          distance: cellLineDistances[i],
                        };
                      })
                      .filter(
                        (model) =>
                          [
                            ...lassoOrBoxSelectedPts,
                            ...sidePanelSelectedPts,
                          ].includes(model.pointIndex) ||
                          (lassoOrBoxSelectedPts.size === 0 &&
                            sidePanelSelectedPts.size === 0)
                      )
                  : models.filter(
                      (model) =>
                        [
                          ...lassoOrBoxSelectedPts,
                          ...sidePanelSelectedPts,
                        ].includes(model.pointIndex) ||
                        (lassoOrBoxSelectedPts.size === 0 &&
                          sidePanelSelectedPts.size === 0)
                    )
              }
              columns={cellLinesForTumorsColumns}
              sorted={[{ id: "distance", desc: true }]}
              downloadURL={downloadUrl}
              selectedTableLabels={
                new Set(
                  [...annotatedPoints].map(
                    (i: number) => alignmentsArr.displayName[i]
                  )
                )
              }
              hideSelectAllCheckbox
            />
          </div>
        </div>
      );
    }
    if (activeTab === "tumors-for-cell-line") {
      const tumorsForCellLinesColumns: Array<WideTableColumns> = ([
        {
          Header: "Tumor Sample ID",
          accessor: "displayName",
          columnDropdownLabel: "Tumor Sample ID",
          Cell: renderCellLineLink,
        },
      ] as Array<WideTableColumns>).concat(COMMON_TABLE_COLUMNS);

      return (
        <div style={{ height: 400 }}>
          <div style={{ height: 380 }}>
            <WideTable
              key={activeTab}
              idProp={"displayName"}
              data={
                tumorDistances
                  ? tumors
                      .map((tumor, i) => {
                        return { ...tumor, distance: tumorDistances[i] };
                      })
                      .filter(
                        (tumor) =>
                          [
                            ...lassoOrBoxSelectedPts,
                            ...sidePanelSelectedPts,
                          ].includes(tumor.pointIndex) ||
                          (lassoOrBoxSelectedPts.size === 0 &&
                            sidePanelSelectedPts.size === 0)
                      )
                  : tumors.filter(
                      (tumor) =>
                        [
                          ...lassoOrBoxSelectedPts,
                          ...sidePanelSelectedPts,
                        ].includes(tumor.pointIndex) ||
                        (lassoOrBoxSelectedPts.size === 0 &&
                          sidePanelSelectedPts.size === 0)
                    )
              }
              columns={tumorsForCellLinesColumns}
              sorted={[{ id: "distance", desc: true }]}
              onChangeSelections={handleChangeCellLineTableSelections}
              selectedTableLabels={
                new Set(
                  [...annotatedPoints].map(
                    (i: number) => alignmentsArr.displayName[i]
                  )
                )
              }
              allowDownloadFromTableData
              hideSelectAllCheckbox
            />
          </div>
        </div>
      );
    }
    return null;
  }

  render() {
    const { methodologyUrl } = this.props;
    const { activeTab } = this.state;
    return (
      <Grid fluid>
        <Row>
          <h1>
            Celligner: Tumor +{" "}
            {!enabledFeatures.celligner_app_v3
              ? `${NAME_FOR_MODEL} model`
              : NAME_FOR_MODEL}{" "}
            alignment
          </h1>
        </Row>
        <Row>
          <Tabs
            activeKey={activeTab}
            onSelect={this.handleSelectTab as SelectCallback}
            id="celligner-tabs"
          >
            <Tab
              eventKey={"cell-line-for-tumors" as ValidTab}
              title={`Rank ${NAME_FOR_MODEL}s for selected tumors`}
            />
            <Tab
              eventKey={"tumors-for-cell-line" as ValidTab}
              title={`Find most similar tumors for a given ${NAME_FOR_MODEL}`}
            />
          </Tabs>
        </Row>
        <Row>
          <Col sm={2}>
            {this.renderControlPanel()}
            <ExplanationText dapi={this.dapi} methodologyUrl={methodologyUrl} />
          </Col>
          <Col sm={10}>
            {this.renderGraph()}
            {this.renderViolinPlot()}
            {this.renderTable()}
          </Col>
        </Row>
      </Grid>
    );
  }
}
