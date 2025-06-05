import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { TopFeatureValue } from "@depmap/types";
import { NetworkOverrepresentation } from "src/celfie/components/NetworkOverrepresentation";
import {
  ConstellationGraphInputs,
  ConnectivityValue,
  GenesetSummary,
  Node,
} from "src/constellation/models/constellation";
import {
  Grid,
  Row,
  Col,
  FormGroup,
  MenuItem,
  Checkbox,
  Form,
} from "react-bootstrap";
import * as utils from "src/celfie/utilities/celfieUtils";
import "src/celfie/styles/celfie.scss";
import { VolcanoPlot } from "src/plot/components/VolcanoPlot";
import DropdownButton from "src/common/components/DropdownButton";
import { Option } from "src/common/models/utilities";
import { UnivariateAssociationsParams, ComputeResponse } from "@depmap/compute";
import { ProgressTracker } from "@depmap/common-components";
import * as Plotly from "plotly.js";
import { DatasetOption } from "src/entity/components/EntitySummary";
import { ColorByOption } from "src/celfie/models/celfie";
import HelpModal from "src/common/components/HelpModal";
import { getNumGenes } from "src/celfie/utilities/celfieUtils";
import { PlotlyDragmode } from "@depmap/plotly-wrapper";
import {
  Menu,
  Typeahead,
  StringPropertyNames,
} from "react-bootstrap-typeahead";

import "react-bootstrap-typeahead/css/Typeahead.css";

const topFeatureOptions: Array<Option<TopFeatureValue>> = [
  {
    label: "Absolute Correlation",
    value: TopFeatureValue.AbsCorrelation,
  },
  {
    label: "Max Correlation",
    value: TopFeatureValue.MaxCorrelation,
  },
  {
    label: "Min Correlation",
    value: TopFeatureValue.MinCorrelation,
  },
  {
    label: "-log10(P)",
    value: TopFeatureValue.NegLogP,
  },
];

interface CelfiePageProps {
  getGraphData: (
    taskIds: string,
    numGenes: number,
    similarityMeasure: string,
    connectivity: ConnectivityValue,
    topFeature: TopFeatureValue
  ) => Promise<ConstellationGraphInputs>;
  getVolcanoData: (taskIds: string) => Promise<ComputeResponse>;
  similarityOptions: Array<Option<string>>;
  colorOptions: Array<Option<string>>;
  connectivityOptions: Array<Option<ConnectivityValue>>;
  targetFeatureLabel: string;
  datasets: Array<Option<string>>;
  getComputeUnivariateAssociations: (
    params: UnivariateAssociationsParams
  ) => Promise<ComputeResponse>;
  dependencyProfileOptions: Array<DatasetOption>;
  onCelfieInitialized: () => void;
  howToImg: string;
  methodIcon: string;
  methodPdf: string;
}

export const defaultData: ConstellationGraphInputs = {
  network: {
    nodes: [],
    edges: [],
  },
  overrepresentation: {
    gene_sets_down: {
      n: [],
      neg_log_p: [],
      p_value: [],
      rank: [],
      term: [],
      term_short: [],
      type: [],
      genes: [],
      x: [],
      y: [],
    },
    gene_sets_up: {
      n: [],
      neg_log_p: [],
      p_value: [],
      rank: [],
      term: [],
      term_short: [],
      type: [],
      genes: [],
      x: [],
      y: [],
    },
  },
  table: [],
};

function CelfiePage({
  datasets,
  similarityOptions,
  colorOptions,
  connectivityOptions,
  targetFeatureLabel,
  dependencyProfileOptions,
  howToImg,
  methodIcon,
  methodPdf,
  getComputeUnivariateAssociations,
  getVolcanoData,
  getGraphData,
  onCelfieInitialized,
}: CelfiePageProps) {
  const [graphData, setGraphData] = useState(defaultData);
  const [selectedDatasetIds, setSelectedDatasetIds] = useState(
    datasets.map((dataset) => {
      return dataset.label;
    })
  );
  const [volcanoData, setVolcanoData] = useState<any[]>([]);
  const initDatasetTasks: { [dataset: string]: string } = useMemo(() => {
    return datasets.reduce(
      (
        accumulator: { [dataset: string]: string },
        currentValue: Option<string>
      ) => {
        return {
          ...accumulator,
          [currentValue.label]: null,
        } as any;
      },
      {}
    );
  }, [datasets]);
  const [datasetTasks, setDatasetTasks] = useState<{
    [dataset: string]: string;
  }>(initDatasetTasks);
  const [datasetTaskPromises, setDatasetTaskPromises] = useState<{
    [dataset: string]: Promise<ComputeResponse>;
  }>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFirstLoad, setIsFirstLoad] = useState<boolean>(true);
  const [showHelpModal, setShowHelpModal] = useState(
    !(localStorage.getItem("celfie-help-modal") === "true")
  );
  const [volcanoLimit, setVolcanoLimit] = useState(1000);

  // Options
  const [dataLimit, setDataLimit] = useState(200); // change to prop if don't need to change
  const [similarityMeasure, setSimilarityMeasure] = useState(
    similarityOptions[0]
  );
  const [colorBy, setColorBy] = useState(colorOptions[0]);
  const [connectivity, setConnectivity] = useState<Option<ConnectivityValue>>(
    connectivityOptions[1]
  );
  const [topFeature, setTopFeature] = useState(topFeatureOptions[0]);
  const [dependencyProfileOption, setDependencyProfileOption] = useState(
    dependencyProfileOptions[0]
  );

  // Ref for checkbox static volcano plots
  const checkboxPlotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const volcanoPlotRef = useRef(null);
  const networkPlotRef = useRef(null);

  const [annotatedPoints, setAnnotatedPoints] = useState<any[]>([]);
  const [downloadVolcanoData, setDownloadVolcanoData] = useState([]);

  const [highlightedPoints, setHighlightedPoints] = useState<{
    volcanoIndexes: number[];
    networkIndexes: number[];
  } | null>(null);
  const [highlightedGeneset, setHighlightedGeneset] = useState<any | null>(
    null
  );

  const dragmodeWidgets: Array<PlotlyDragmode> = ["zoom", "pan"];

  const resetData = useCallback((): void => {
    setGraphData(defaultData);
    setVolcanoData([]);
    setSelectedDatasetIds(
      datasets.map((dataset) => {
        return dataset.label;
      })
    );
    setDatasetTasks(initDatasetTasks);
    setIsLoading(true);
    setSimilarityMeasure(similarityOptions[0]);
    setConnectivity(connectivityOptions[1]);
    setColorBy(colorOptions[0]);
    setDataLimit(200);
    setVolcanoLimit(1000);
    setTopFeature(topFeatureOptions[0]);
  }, [
    datasets,
    initDatasetTasks,
    connectivityOptions,
    colorOptions,
    similarityOptions,
  ]);

  /**
   * Resets data initially to default states and create dict to map dataset to task promises
   * for ProgressTracker
   */
  useEffect(() => {
    // Reset data
    resetData();
    const datasetPromises = datasets.reduce(
      (
        accumulator: { [dataset: string]: Promise<ComputeResponse> },
        dataset: Option<string>
      ) => {
        const promise = getComputeUnivariateAssociations({
          analysisType: "pearson",
          datasetId: dataset.value,
          queryId: `slice/${dependencyProfileOption.dataset}/${dependencyProfileOption.entity}/entity_id`,
          queryCellLines: null,
        });
        // eslint-disable-next-line no-param-reassign
        accumulator[dataset.label] = promise;
        return accumulator;
      },
      {}
    );
    setDatasetTaskPromises(datasetPromises);
  }, [
    datasets,
    getComputeUnivariateAssociations,
    dependencyProfileOption,
    resetData,
  ]);

  /**
   * Fetch successful task compute responses which will be set as volcano data
   */
  useEffect(() => {
    const datasetTaskIds: Array<string | null> = Object.values(datasetTasks);
    if (!datasetTaskIds.includes(null)) {
      Promise.all([
        ...(datasetTaskIds as string[]).map((taskId) => getVolcanoData(taskId)),
      ]).then((volcanoDataResponses) => {
        setVolcanoData(volcanoDataResponses);
      });
    }
  }, [getVolcanoData, datasetTasks]);

  const formattedData = useMemo(
    () =>
      utils.formatTopVolcanoData(
        volcanoData,
        selectedDatasetIds.map((dataset) => {
          return { dataset, taskId: datasetTasks[dataset] };
        }),
        volcanoLimit
      ),
    [datasetTasks, selectedDatasetIds, volcanoData, volcanoLimit]
  );

  /**
   * If there are selected tasks/datasets, set loading when fetching graph data from graph endpoint
   * Filter volcano data to select top 1000 points based on which datasets are selected
   * Set annotated points and set data to download based on top points
   */
  useEffect(() => {
    if (volcanoData.length > 0) {
      // gets list of selected task ids and filters out nulls
      const selectedTaskIds = selectedDatasetIds
        .map((dataset) => datasetTasks[dataset])
        .filter((val) => val);
      if (selectedTaskIds.length > 0) {
        setIsLoading(true);
        const taskIdsString = selectedTaskIds.join();

        getGraphData(
          taskIdsString,
          dataLimit,
          similarityMeasure.value,
          connectivity.value,
          topFeature.value
        ).then((data) => {
          setGraphData(data);
          setIsLoading(false);
          if (isFirstLoad) {
            onCelfieInitialized();
            setIsFirstLoad(false);
          }
        });

        const selectedDatasets = selectedDatasetIds.map((dataset) => {
          return { dataset, taskId: datasetTasks[dataset] };
        });
        // We initially annotate top 10 correlated features
        const initAnnotatedPoints = formattedData.slice(0, 10);
        // We want to initially annotate target point as well. If not already in top 10 annotations, find it.
        // We find the highest correlated biomarker dataset for the feature since formattedData should be sorted by abs(cor)
        const targetPoint = initAnnotatedPoints.find(
          (pt) => pt.label === targetFeatureLabel
        );
        if (targetPoint == null) {
          // Note: targetPoint may be undefined/null if it is compound since currently only genes are used for feature correlations
          const targetData = formattedData.find(
            (el) => el.label === targetFeatureLabel
          );
          if (targetData) {
            initAnnotatedPoints.push(targetData);
          }
        }

        setAnnotatedPoints(initAnnotatedPoints);
        setDownloadVolcanoData(
          utils.getDownloadVolcanoData(formattedData, selectedDatasets)
        );
      } else {
        setGraphData(defaultData);
        setAnnotatedPoints([]);
      }
    }
  }, [
    selectedDatasetIds,
    dataLimit,
    similarityMeasure,
    connectivity,
    getGraphData,
    datasetTasks,
    topFeature,
    volcanoData,
    onCelfieInitialized,
    isFirstLoad,
    volcanoLimit,
    targetFeatureLabel,
    formattedData,
  ]);

  // allow the ProgressTracker polling frequency to be overriden if this key is set.
  // If not set, it will be set to null which should cause ProgressTracker to use the default frequency.
  const nextPollDelayStr = localStorage.getItem("dev-override-nextPollDelay");
  let nextPollDelay: number | null = null;
  if (nextPollDelayStr) {
    nextPollDelay = Number.parseInt(nextPollDelayStr, 10);
  }
  // create a mapping from task id to color
  const colorForDatasetTask = useCallback((): { [dataset: string]: string } => {
    const colorForDatasetTaskMap: { [task: string]: string } = {};
    datasets.forEach((dataset: Option<string>, index: number) => {
      colorForDatasetTaskMap[
        datasetTasks[dataset.label]
      ] = utils.getColorForDataset(index);
    });
    return colorForDatasetTaskMap;
  }, [datasets, datasetTasks]);

  /**
   * If there is volcano data, format the traces and layout to plot mini volcano plots
   * for checkboxes.
   */
  useEffect(() => {
    if (volcanoData.length > 0) {
      datasets.forEach((dataset, i) => {
        const datasetVolcanoData = volcanoData.filter((data) => {
          return data.id === datasetTasks[dataset.label];
        });
        const plotlyTrace = utils.formatTrace(
          utils.reformatToVolcanoData(
            datasetVolcanoData,
            [{ dataset: dataset.label, taskId: datasetTasks[dataset.label] }],
            colorForDatasetTask(),
            volcanoLimit
          )
        );
        const plotlyLayout = utils.formatLayout();

        if (checkboxPlotsRef.current[i] !== null) {
          Plotly.newPlot(
            checkboxPlotsRef.current[i] as HTMLDivElement,
            plotlyTrace,
            plotlyLayout,
            {
              staticPlot: true,
            }
          );
        }
      });
    }
  }, [datasets, volcanoData, datasetTasks, colorForDatasetTask, volcanoLimit]);

  /*
  This is kinda a hacky solution. 
  I remove the layout props from the VolcanoPlot and NetworkPlot components so when new annotated points are added, 
  the new annotations object created from the annotatedPoints state does not rerender those components
  The annotatedPoints state still get updated so both plots share same annotations but this gets passed
  into Plotly.relayout as an update to the layout parameter and updates the DOM node
  */
  useEffect(() => {
    if (annotatedPoints && volcanoPlotRef.current) {
      const currentPlotAnnotations = utils.getCurrentPlotAnnotations(
        volcanoPlotRef
      );
      const newAnnotatedPoints = utils.formatVolcanoAnnotations(
        annotatedPoints,
        currentPlotAnnotations
      );
      Plotly.relayout(volcanoPlotRef.current, {
        annotations: newAnnotatedPoints,
      });
    }
  }, [annotatedPoints]);

  useEffect(() => {
    // pass in colorBy state as well since it is used as part of network plot layout
    if (annotatedPoints && networkPlotRef.current && colorBy) {
      const currentPlotAnnotations = utils.getCurrentPlotAnnotations(
        networkPlotRef
      );
      const newAnnotatedPoints = utils.formatNetworkAnnotations(
        annotatedPoints,
        graphData.network.nodes,
        currentPlotAnnotations
      );
      Plotly.relayout(networkPlotRef.current, {
        annotations: newAnnotatedPoints,
      });
    }
  }, [annotatedPoints, graphData, colorBy]);

  /*
  Use Plotly restyle to change point symbol to show it it highlighted. This prevents the zoom reset.
  */
  useEffect(() => {
    if (highlightedPoints && volcanoPlotRef.current) {
      const symbols = Array(formattedData.length)
        .fill(undefined)
        .map(() => {
          return "circle";
        });
      const lineWidths = Array<number>(formattedData.length).fill(0);
      highlightedPoints.volcanoIndexes.forEach((index: number) => {
        symbols[index] = "star";
        lineWidths[index] = 2;
      });
      const update = {
        "marker.line": { width: lineWidths },
        "marker.symbol": [symbols],
      };

      Plotly.restyle(volcanoPlotRef.current, update, 0);
    }
  }, [formattedData, highlightedPoints]);

  /*
  When there is a geneset selected, set highlighted Nodes
  */
  useEffect(() => {
    // Initialize list of highlighted nodes for each plot
    const plotIndexes: {
      networkIndexes: Array<number>;
      volcanoIndexes: Array<number>;
    } = {
      networkIndexes: [],
      volcanoIndexes: [],
    };
    if (highlightedGeneset) {
      // Get list of gene sets that are up or down regulated
      let genesetSummary: GenesetSummary;
      if (highlightedGeneset.direction === "Pos") {
        genesetSummary = graphData.overrepresentation.gene_sets_up;
      } else {
        genesetSummary = graphData.overrepresentation.gene_sets_down;
      }
      // Find index of geneset clicked in table in list of gene sets
      const index = genesetSummary.term.findIndex(
        (geneset: string) => geneset === highlightedGeneset.geneset
      );
      // List of genes in that gene set have same index as gene set index
      const genesInGeneset = genesetSummary.genes[index];

      // Filter nodes in network that are in list of genes for chosen gene set
      // and the chosen gene set is in list of node's genesets
      let genesetNodes: Node[] = [];
      if (genesInGeneset && genesInGeneset.length > 0) {
        genesetNodes = graphData.network.nodes.filter(
          (node: Node, idx: number) => {
            const nodeInGeneset =
              genesInGeneset.includes(node.feature) &&
              node.gene_sets.includes(highlightedGeneset.geneset);
            // Add index of the node to list of network nodes to highlight
            if (nodeInGeneset) {
              plotIndexes.networkIndexes.push(idx);
            }
            return nodeInGeneset;
          }
        );
      }
      // "SLC24A5" node 7 in reactome melanin biosyntheses but not in node genesets. WHy?
      if (genesetNodes) {
        formattedData.forEach((dataFormatted, idx) => {
          if (
            // volcanoData id is the task id
            genesetNodes.find(
              (el) =>
                el.feature === dataFormatted.label &&
                el.task === dataFormatted.id
            )
          ) {
            plotIndexes.volcanoIndexes.push(idx);
          }
        });
      }
    }

    // Find the target gene index (the target gene with the highest cor val since it's sorted by cor)
    const getTargetGene = (data: utils.TaskComputeResponseRow) =>
      data.label === targetFeatureLabel;
    // Note: Index might not be found if compound as currently we only support correlated genes as features
    const targetVolcanoIndex = formattedData.findIndex(getTargetGene);
    // If the target gene is not already highlighted, add it to the network nodes to be highlighted
    // Do we only care about highlighting the target gene in the network node?
    if (
      !plotIndexes.volcanoIndexes.includes(targetVolcanoIndex) &&
      targetVolcanoIndex >= 0
    ) {
      plotIndexes.volcanoIndexes.push(targetVolcanoIndex);
      const targetGene = formattedData[targetVolcanoIndex];
      const targetNetworkIndex = graphData.network.nodes.findIndex(
        (node) => node.task === targetGene.id
      );
      plotIndexes.networkIndexes.push(targetNetworkIndex);
    }

    setHighlightedPoints(plotIndexes);
  }, [formattedData, graphData, highlightedGeneset, targetFeatureLabel]);

  /*
  Use Plotly restyle to change point symbol to show it it highlighted. This prevents the zoom reset.
  Also changes the color of points based on colorby option. Potentially be split into different useEffects?
  */
  useEffect(() => {
    if (highlightedPoints && colorBy && networkPlotRef.current) {
      const { nodes } = graphData.network;
      const symbols: Array<string> = Array(nodes.length)
        .fill(undefined)
        .map(() => {
          return "circle";
        });
      const lineWidths = Array<number>(nodes.length).fill(0);

      highlightedPoints.networkIndexes.forEach((index: number) => {
        symbols[index] = "star";
        lineWidths[index] = 2;
      });
      const networkPlotColorUpdate = utils.getNetworkPlotlyDataColor(
        datasetTasks,
        colorBy.value as ColorByOption,
        colorBy.value === "direction"
          ? nodes.map((node) => node.effect)
          : (nodes.map(
              (node) => node[colorBy.value as "effect" | "-log10(P)" | "task"]
            ) as any),
        colorForDatasetTask()
      );

      if (networkPlotColorUpdate?.marker) {
        networkPlotColorUpdate.marker.line = { width: lineWidths };
        networkPlotColorUpdate.marker.symbol = symbols;
      }

      Plotly.restyle(networkPlotRef.current, networkPlotColorUpdate, 0);
    }
  }, [
    colorBy,
    colorForDatasetTask,
    datasetTasks,
    graphData,
    highlightedPoints,
  ]);

  const searchBar = () => {
    // Only show unannotated options
    const options = formattedData.filter((node) => {
      return !annotatedPoints.includes(node);
    });

    return (
      <Typeahead
        id="volcano-search"
        labelKey={
          "featureDataset" as StringPropertyNames<utils.TaskComputeResponseRow>
        }
        clearButton
        onChange={(selectedPoints) => {
          if (selectedPoints.length) {
            const point = selectedPoints[0];
            const updatedAnnotatedPoints = [...annotatedPoints];
            updatedAnnotatedPoints.push(point);
            setAnnotatedPoints(updatedAnnotatedPoints);
          }
        }}
        options={options}
        placeholder="Search features..."
        renderMenuItemChildren={(option, _, index) => (
          <div>
            {index !== 0 && <Menu.Divider />}
            {option.label}
            <div>
              <small>
                {`Task: ${selectedDatasetIds.find(
                  (datasetId) => datasetTasks[datasetId] === option.id
                )}`}
              </small>
            </div>
          </div>
        )}
      />
    );
  };

  const getCheckBoxForTask = () => {
    return datasets.map((dataset, i) => {
      const idx = i;
      return (
        <Checkbox
          key={dataset.value}
          checked={selectedDatasetIds.includes(dataset.label)}
          onChange={utils.selectDatasets(
            dataset.label,
            selectedDatasetIds,
            setSelectedDatasetIds
          )}
          inline
        >
          <div>
            <span>{dataset.label}</span>
            <div
              key={dataset.value + idx}
              ref={(el) => {
                checkboxPlotsRef.current[i] = el;
              }}
              style={{ border: "1px solid black" }}
            />
          </div>
          <div>
            {`Number of cell lines: ${
              volcanoData.find(
                (response) => response.id === datasetTasks[dataset.label]
              )?.result.numCellLinesUsed
            }`}
            <br />
            {`Number of features: ${
              volcanoData.find(
                (response) => response.id === datasetTasks[dataset.label]
              )?.result.totalRows
            }`}
          </div>
        </Checkbox>
      );
    });
  };

  const graphOptions = () => {
    return (
      <Form inline>
        <FormGroup controlId="num-genes">
          <DropdownButton
            id="num-genes"
            selectedEventKey={dataLimit}
            onSelect={setDataLimit}
            description="Number of genes"
            helperText={
              <div>
                N number of genes to include in network plot and gene set
                overrepresentation analysis
                <br />
                <br />
                Only genes with network data and a relationship to another top
                gene are displayed
              </div>
            }
          >
            {getNumGenes(50, 500).map((num: number) => (
              <MenuItem key={num} eventKey={num}>
                {num}
              </MenuItem>
            ))}
          </DropdownButton>
        </FormGroup>
        <FormGroup controlId="top-feature">
          <DropdownButton
            id="top-feature"
            selectedEventKey={topFeature}
            onSelect={setTopFeature}
            description="Select by"
            helperText={
              <div>
                <b>Absolute correlation:</b> N genes with the largest absolute
                correlation
                <br />
                <br />
                <b>Max correlation:</b> N genes with the largest positive
                correlation
                <br />
                <br />
                <b>Min correlation:</b> N genes with the largest negative
                correlation
                <br />
                <br />
                <b>-log10(P):</b> N genes with the largest <br />
                -log10(p-value)
              </div>
            }
          >
            {topFeatureOptions.map((option) => (
              <MenuItem key={option.value} eventKey={option}>
                {option.label}
              </MenuItem>
            ))}
          </DropdownButton>
        </FormGroup>
        <FormGroup controlId="edges">
          <DropdownButton
            id="edges"
            selectedEventKey={similarityMeasure}
            onSelect={setSimilarityMeasure}
            description="Edges defined by"
            helperText={
              <div>
                <b>CRISPR (Avana) Codependency:</b> Pearson correlation between
                gene pairs
                <br />
                <br />
                <b>MSigDB Curated Pathways:</b> Similarity of membership in
                MSigDB v7.1 C2 and H gene sets
                <br />
                <br />
                <b>String DB:</b> Three separate{" "}
                <a href="https://string-db.org/cgi/download.pl?sessionId=sbsU5bSs93Ev&species_text=Homo+sapiens">
                  STRING-DB
                </a>{" "}
                edge types: protein-protein interaction (PPi), literature, and
                combined
                <br />
                <br />
                <b>Feature Correlation:</b> Pearson correlation between feature
                pairs
                <br />
                <br />
                <b>BioPlex PPi 293T Cells:</b> Bioplex 3.0 interactions in 293T
                cells from{" "}
                <a href="https://bioplex.hms.harvard.edu/interactions.php">
                  BioPlex Interactions
                </a>
                <br />
                <br />
              </div>
            }
          >
            {similarityOptions.map((option) => (
              <MenuItem key={option.value} eventKey={option}>
                {option.label}
              </MenuItem>
            ))}
          </DropdownButton>
        </FormGroup>
        <FormGroup controlId="connectivity">
          <DropdownButton
            id="connectivity"
            selectedEventKey={connectivity}
            onSelect={setConnectivity}
            description="Connectivity"
          >
            {connectivityOptions.map((option) => (
              <MenuItem key={option.value} eventKey={option}>
                {option.label}
              </MenuItem>
            ))}
          </DropdownButton>
        </FormGroup>
        <FormGroup controlId="color-by">
          <DropdownButton
            id="color-by"
            selectedEventKey={colorBy}
            onSelect={setColorBy}
            description="Color by"
          >
            {colorOptions.map((option) => (
              <MenuItem key={option.value} eventKey={option}>
                {option.label}
              </MenuItem>
            ))}
          </DropdownButton>
        </FormGroup>
      </Form>
    );
  };

  const updateDatasetTasks = (dataset: string, result: ComputeResponse) => {
    const newDatasetTasks = { ...datasetTasks };
    newDatasetTasks[dataset] = result.id;
    return newDatasetTasks;
  };

  const updateAnnotatedPoints = (selectedPoint: any) => {
    // regex to grab the label of interest to find by
    const labelRegex = /<b>(.*)<\/b>.*/;
    const label = selectedPoint.text.replace(labelRegex, "$1");
    const datasetRegex = /.*<i>Feature Type:<\/i> (.*)/;
    const dataset = selectedPoint.text.replace(datasetRegex, "$1");
    const pointToAdd:
      | utils.TaskComputeResponseRow
      | undefined = formattedData.find(
      (el) => el.label === label && el.id === datasetTasks[dataset]
    );
    const newAnnotatedPoints = [...annotatedPoints];
    // remove annotation if already annotated
    const index = annotatedPoints.findIndex(
      (el) => el.id === pointToAdd?.id && el.label === pointToAdd?.label
    );
    if (index >= 0) {
      newAnnotatedPoints.splice(index, 1);
    } else {
      newAnnotatedPoints.push(pointToAdd);
    }
    setAnnotatedPoints(newAnnotatedPoints);
  };

  const onButtonClickLongTable = useCallback((data: any): void => {
    setHighlightedGeneset(data.rowData);
  }, []);

  const helpInfo = (
    <>
      <p>
        On this page you’d be able to view the genomic features associated with{" "}
        {targetFeatureLabel} dependency, as well as explore the various
        relationships they have to each other.
      </p>
      <p>
        This is still in development and currently takes a while (~60s) to load.
        Our goal is to have it display the results instantaneously in the
        future.
      </p>

      <img
        src={howToImg}
        style={{ width: "90%" }}
        alt="genomic-associations-tutorial"
      />
    </>
  );

  const downloadMethodologyIcon = () => {
    return (
      <div>
        <a href={methodPdf} download>
          <img
            src={methodIcon}
            alt="download-methodology-pdf"
            className="icon"
          />
          <span>Information about this page</span>
        </a>
      </div>
    );
  };

  return (
    <>
      {volcanoData.length > 0 ? (
        <Grid fluid>
          <Row style={{ position: "relative" }}>
            <p>
              <i>
                On this page you’d be able to view the genomic features
                associated with {targetFeatureLabel} dependency, as well as
                explore the various relationships they have to each other. It’s
                still in development and currently takes a while (~60s) to load.
                Our goal is to have it display the results instantaneously in
                the future.
              </i>
            </p>
            {downloadMethodologyIcon()}
            <br />
            <Col xs={12} md={6}>
              <DropdownButton
                id="dependency-profile"
                selectedEventKey={dependencyProfileOption}
                onSelect={setDependencyProfileOption}
                description="Select dependency profile"
              >
                {dependencyProfileOptions.map((option) => (
                  <MenuItem key={option.id} eventKey={option}>
                    {option.label}
                  </MenuItem>
                ))}
              </DropdownButton>
              <DropdownButton
                id="volcanoLimit"
                selectedEventKey={volcanoLimit}
                onSelect={setVolcanoLimit}
                description="Number of features"
                helperText={
                  <div>Top N features to show on the volcano plot</div>
                }
              >
                {getNumGenes(200, 3000).map((num: number) => (
                  <MenuItem key={num} eventKey={num}>
                    {num}
                  </MenuItem>
                ))}
              </DropdownButton>
            </Col>
            <Col xs={12} md={6} className="pull-right">
              {graphOptions()}
            </Col>
          </Row>
          <Col xs={12} md={6}>
            <div className="celfie-wrapper">
              <p>
                <i>
                  Top features associated with {targetFeatureLabel}’s dependency
                  profile
                </i>
              </p>
              <VolcanoPlot
                Plotly={Plotly}
                ref={volcanoPlotRef}
                idPrefixForUniqueness="celfie-volcano-plot"
                data={utils.reformatToVolcanoData(
                  volcanoData,
                  selectedDatasetIds.map((dataset) => {
                    return { dataset, taskId: datasetTasks[dataset] };
                  }),
                  colorForDatasetTask(),
                  volcanoLimit
                )}
                xLabel="Pearson Correlation Coefficient"
                yLabel="PValue"
                bounds={{ height: 500, width: undefined }} // width undefined so it fills entire div
                downloadIconWidgetProps={{
                  downloadFilename: `${targetFeatureLabel}_vs_${selectedDatasetIds}_top_1000_by_negLogPValue`,
                  downloadDataArray: downloadVolcanoData,
                }}
                onPointClick={updateAnnotatedPoints}
                dragmodeWidgetOptions={dragmodeWidgets}
                additionalToolbarWidgets={[searchBar()]}
                onSelectedLabelChange={() => {}}
              />
              <div className="checkbox-div">
                <p>
                  <b>Select feature datasets to display:</b>
                </p>
                {getCheckBoxForTask()}
              </div>
              {isLoading && isFirstLoad ? (
                <div className="loading">
                  <div>
                    <b>Loading...</b>
                  </div>
                </div>
              ) : null}
            </div>
          </Col>
          <Col xs={12} md={6}>
            <NetworkOverrepresentation
              ref={networkPlotRef}
              graphData={graphData}
              isLoading={isLoading}
              dataOptions={utils.formatNetworkPlotlyData(
                graphData.network.nodes,
                datasetTasks
              )}
              onPointClick={updateAnnotatedPoints}
              onButtonClickLongTable={onButtonClickLongTable}
              dragmodeWidgetOptions={dragmodeWidgets}
            />
          </Col>
        </Grid>
      ) : (
        Object.keys(datasetTaskPromises).length > 0 &&
        datasets.map((datasetId: Option<string>) => (
          <div key={datasetId.value}>
            <b>{datasetId.label}</b>
            <ProgressTracker
              nextPollDelay={nextPollDelay}
              submissionResponse={datasetTaskPromises[datasetId.label]}
              onSuccess={(result: ComputeResponse) => {
                const updatedDatasetTasks = updateDatasetTasks(
                  datasetId.label,
                  result
                );
                setDatasetTasks(updatedDatasetTasks);
              }}
              onFailure={() => {
                console.log("FAILURE");
              }}
              getTaskStatus={getVolcanoData}
            />
          </div>
        ))
      )}
      <HelpModal
        content={helpInfo}
        itemKey="celfie-help-modal"
        show={showHelpModal}
        setShowHelpModal={setShowHelpModal}
      />
    </>
  );
}

export default CelfiePage;
