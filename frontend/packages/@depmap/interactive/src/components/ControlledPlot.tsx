/* eslint-disable */
import * as React from "react";
import update from "immutability-helper";

import { enabledFeatures, errorHandler } from "@depmap/globals";
import {
  ButtonGroup,
  Checkbox,
  Spinner,
  SwapXYButton,
} from "@depmap/common-components";
import {
  CellData,
  CellLineListsDropdown,
  CellLineSelectorLines,
  CustomList,
  DEFAULT_EMPTY_CELL_LINE_LIST,
  LocalStorageListStore,
  loadCellLines,
} from "@depmap/cell-line-selector";
import {
  UploadFormat,
  UploadTask,
  UserUploadArgs,
  UserUploadModal,
} from "@depmap/user-upload";
import {
  DropdownState,
  OptionsInfoSelected,
  SectionState,
  Trace,
  AssociationAndCheckbox,
  Link,
  OverrideSection,
  Section,
  MetadataIds,
  PlotFeatures,
} from "../models/interactive";
import { encodeUrl, encodeParams } from "@depmap/utils";

import {
  AnalysisType,
  CeleryTask,
  ComputeResponseResult,
  CustomAnalysisResult,
  Dataset,
} from "@depmap/compute";

import {
  getRootOptionsAsPath,
  formatPathToDropdown,
  formatPathsToDropdowns,
  reformatLinRegTable,
  formatAxisLabel,
  buildTraces,
  formatCsvDownloadData,
  formatCsvDownloadFilename,
} from "../utilities/interactiveUtils";
import { PageLinkAccordion } from "./PageLinkAccordion";
import Accordion from "./Accordion";
import {
  ControlledAssociationTable,
  ControlledAssociationTableProps,
} from "./AssociationTable";
import { StaticTable } from "./StaticTable";
import { VectorCatalog } from "./VectorCatalog";
import { Plot, PlotResizer } from "./Plot";
import { ApiContext } from "@depmap/api";
import EndOfSupportBanner from "./EndOfSupportBanner";
import OpenInDE2Button from "./OpenInDE2Button";

import "../styles/ControlledPlot.scss";

type PlotlyType = typeof import("plotly.js");

const overrideSections: Array<OverrideSection> = ["color", "filter"];
const sections: Array<Section> = ["x", "y"].concat(
  overrideSections
) as Array<Section>;

// bbapi and dapi both use this
export interface ControlledPlotApi {
  getFeaturePlot: (
    features: string[],
    groupBy: string,
    filter: string,
    computeLinearFit: boolean
  ) => Promise<PlotFeatures>;
  getCellLineSelectorLines: () => Promise<CellLineSelectorLines>;
  getDatasets: () => Promise<Dataset[]>;

  getAssociations: (x: string) => Promise<AssociationAndCheckbox>;
  urlPrefix: string;
  getTaskStatus: (id: string) => Promise<CeleryTask>;
  postCustomTaiga: (config: UserUploadArgs) => Promise<UploadTask>;
  postCustomCsv: (config: UserUploadArgs) => Promise<UploadTask>;
}

interface LmStatsResult {
  table: Array<{ [index: string]: string }>;
}

interface LmStatsTableState {
  waitingForQuery: boolean;
  failed: boolean;
  result: LmStatsResult;
  selected: number;
  selectedLabel: string;
}

export interface ControlledPlotProps {
  Plotly: PlotlyType;
  features?: string[];
  groupBy?: string;
  filter?: string;
  x?: string;
  y?: string;
  color?: string;
  regressionLine?: string;
  associationTable?: string;
  defaultCustomAnalysisToX: string; // string boolean flag, not stored on state cos doesn't change
  colors?: string;
  showCustomAnalysis: boolean;
  updateReactLoadStatus?: () => void;
  launchCellLineSelectorModal: () => void;
  initialCustomAnalysisResults?: {
    customAnalysisResult: {
      result: ComputeResponseResult;
      type: AnalysisType;
    };
    queryLimit?: number;
    numCellLinesUsed: number;
    showingCustomAnalysis: boolean;
    queryVectorId: string;
    override: any;
  };
}

interface AssociationsState extends AssociationAndCheckbox {
  id?: string;
}

// if adding any fields, add to initialization so that code can expect things to be here
// these properties are optional because this was before we discovered Partial<Type> for type definition of state updates. A refactor to use that could get rid of the optionals
export interface ControlledPlotState {
  x: SectionState;
  y: SectionState;
  color: SectionState;
  filter: SectionState;
  override: {
    color: string;
    filter: string;
  };
  traces: Array<Trace>;
  xLabel: string;
  yLabel: string;
  table?: (string | number)[][];
  features?: string[];
  cellLineDisplaynames?: string[];
  depmapIds?: string[];
  primaryDiseases?: string[];
  dataSets: string[];
  filters?: string;
  groupBy?: string;
  tracesAndStatisticsTableIsLoading?: boolean;
  associations: AssociationsState;
  associationsIsLoading?: boolean;
  show: {
    regressionLine: boolean;
    associationTable: boolean;
    allControls: boolean; // right now, just gates showing the linear regression accordion
    xHasBeenSet: boolean;
    axesOnSameScale: boolean;
    labelHighlightedCellLines: boolean;
  };
  stateInitialized?: boolean;
  resizer: PlotResizer;
  lmStats?: LmStatsTableState;
  selectedCellLineList: CustomList;

  showAssociationsModal?: boolean;
  cellLineData: Map<string, CellData>;
  datasets?: Array<Dataset>;
  showingCustomAnalysis?: boolean;
  customAnalysisResult: {
    result?: ComputeResponseResult;
    type?: AnalysisType;
  };
  queryVectorId?: string; // possibly a little weird that this is here?
  queryLimit?: number;
  numCellLinesUsed?: number;
  selectedDepMapIds?: Array<string>;

  showTaigaUploadModal: boolean;
  showCsvUploadModal: boolean;

  csvDownloadData: Array<Record<string, string | number>>;
  csvDownloadFilename: string;
}

export class ControlledPlot extends React.Component<
  ControlledPlotProps,
  ControlledPlotState
> {
  declare context: React.ContextType<typeof ApiContext>;
  static contextType = ApiContext;

  static defaultProps = {
    defaultCustomAnalysisToX: "false",
  };

  constructor(
    props: ControlledPlotProps,
    context: React.ContextType<typeof ApiContext>
  ) {
    super(props, context);

    this.cellLineListStore = new LocalStorageListStore();
    this.api = context.getApi();
    this.state = {
      x: new SectionState(),
      y: new SectionState(),
      color: new SectionState(),
      filter: new SectionState(),
      override: {
        color: "",
        filter: "",
      },
      traces: Array<Trace>(),
      xLabel: "",
      yLabel: "",
      table: [[]],
      features: [],
      cellLineDisplaynames: [],
      depmapIds: [],
      primaryDiseases: [],
      dataSets: [],
      tracesAndStatisticsTableIsLoading: false,
      associations: {
        data: [],
        associatedDatasets: [],
        datasetLabel: "",
        featureLabel: "",
        id: "",
        checkboxes: [],
      },
      associationsIsLoading: false,
      show: {
        regressionLine: this.props.regressionLine == "true", // to account for blank strings
        associationTable: this.props.associationTable == "true",
        allControls: !!(this.props.x && this.props.y), // required cos this.props._Feature can be a string
        xHasBeenSet: !!this.props.x, // required cos this.props._Feature can be a string
        axesOnSameScale: false, // I'm just not going to include this in the url unless someone asks for it
        labelHighlightedCellLines: false, // default off because it labels all if no list is selected (it labels everything, and we don't want people to struggle to find where to turn it off). also, this can't be fully defined by the url, because cell line groups are stores in cookies, and users may further toggle individual lines outside the group
      },
      stateInitialized: false,
      resizer: new PlotResizer(),
      lmStats: {
        waitingForQuery: false,
        failed: false,
        result: { table: [] },

        selected: 0,
        selectedLabel: "",
      },
      selectedCellLineList: DEFAULT_EMPTY_CELL_LINE_LIST,

      showAssociationsModal: false,
      cellLineData: new Map(),
      datasets: undefined,
      customAnalysisResult: {
        result: undefined,
        type: undefined,
      },
      queryVectorId: undefined,
      queryLimit: 1000, // default
      showingCustomAnalysis: false,
      numCellLinesUsed: undefined,
      selectedDepMapIds: [],
      showTaigaUploadModal: false,
      showCsvUploadModal: false,
      csvDownloadData: [],
      csvDownloadFilename: "plot_has_no_points",
    };
  }

  // TODO: restrict `key` to a known set of strings
  vectorCatalogs: { [key: string]: any } = {}; // refs for vector catalogs

  customAnalysisResult: any = null; // ref for the result component

  initialDropdowns: Record<Section, DropdownState[]> = {
    x: [],
    y: [],
    color: [],
    filter: [],
  };
  continuousRootDropdowns: Array<DropdownState> = [];

  cellLineListStore: LocalStorageListStore;

  colors: string | null = this.props.colors ? this.props.colors : null;

  api: ControlledPlotApi;

  cellLineData: any;
  datasets: any;
  queryVectorId: any;
  numCellLinesUsed: any;

  componentDidMount() {
    this.initDropdown();
    this.getCellLines();

    if (
      this.props.initialCustomAnalysisResults &&
      this.props.initialCustomAnalysisResults.override &&
      this.props.initialCustomAnalysisResults.customAnalysisResult
    ) {
      this.onAssociationResultsComplete(
        this.props.initialCustomAnalysisResults.numCellLinesUsed,
        this.props.initialCustomAnalysisResults.customAnalysisResult.result,
        this.props.initialCustomAnalysisResults.queryVectorId,
        this.props.initialCustomAnalysisResults.override.color,
        this.props.initialCustomAnalysisResults.override.filter,
        this.props.initialCustomAnalysisResults.customAnalysisResult.type
      );
    }
  }

  componentDidUpdate(_: ControlledPlotProps, prevState: ControlledPlotState) {
    if (
      this.props.updateReactLoadStatus &&
      prevState.tracesAndStatisticsTableIsLoading &&
      !this.state.tracesAndStatisticsTableIsLoading
    ) {
      this.props.updateReactLoadStatus();
    }
  }

  getCellLines = () => {
    return this.api
      .getCellLineSelectorLines()
      .then((cellLines: CellLineSelectorLines) => {
        this.setState({
          cellLineData: loadCellLines(cellLines),
        });
      });
  };

  /**
   * Gets options for dropdowns, initializes selected to the first one, and gets points to initialize plot
   */
  initDropdown() {
    const newState: Partial<ControlledPlotState> = {
      stateInitialized: true,
    };

    // if props are set, ask for the dropdowns that led to that prop. otherwise, ask for root options
    const xPromise = this.props.x
      ? this.context
          .getVectorCatalogApi()
          .getVectorCatalogPath("continuous", this.props.x)
      : getRootOptionsAsPath("continuous", this.context.getVectorCatalogApi);
    const yPromise = this.props.y
      ? this.context
          .getVectorCatalogApi()
          .getVectorCatalogPath("continuous", this.props.y)
      : getRootOptionsAsPath("continuous", this.context.getVectorCatalogApi);
    const colorPromise = this.props.color
      ? this.context
          .getVectorCatalogApi()
          .getVectorCatalogPath("categorical", this.props.color)
      : getRootOptionsAsPath("categorical", this.context.getVectorCatalogApi);
    const filterPromise = this.props.filter
      ? this.context
          .getVectorCatalogApi()
          .getVectorCatalogPath("binary", this.props.filter)
      : getRootOptionsAsPath("binary", this.context.getVectorCatalogApi);

    getRootOptionsAsPath("continuous", this.context.getVectorCatalogApi).then(
      (path: Array<OptionsInfoSelected>) => {
        // yes, this causes this endpoint to be hit potentially 5 times
        const [dropdowns] = formatPathToDropdown(path);
        this.continuousRootDropdowns = dropdowns;
      }
    );

    // when color gets moved to the new identifier, we can use the sections array as defined above
    // this promise array must be aligned with the sections array (xPromise with x)
    Promise.all([xPromise, yPromise, colorPromise, filterPromise])
      .then((paths: Array<Array<OptionsInfoSelected>>) => {
        const [initialDropdowns, stateUpdates] = formatPathsToDropdowns(
          paths,
          sections
        );
        this.initialDropdowns = initialDropdowns;

        for (const section of sections) {
          if (section in stateUpdates) {
            newState[section] = update(
              this.state[section],
              stateUpdates[section]
            );
          }
        }
      })
      .then(() => {
        return this.api.getDatasets().then((datasets: Dataset[]) => {
          newState.datasets = datasets;
          this.setState(newState as ControlledPlotState);
        });
      })
      .then(() => {
        if (Object.keys(this.props).length > 0) {
          // if any query params have been specified, the state has already been set because of the return... I think

          const loadingState: Partial<ControlledPlotState> = {};
          loadingState.tracesAndStatisticsTableIsLoading = true;
          loadingState.associationsIsLoading = true;
          this.setState(loadingState as ControlledPlotState);

          const sliceIds: string[] = [
            this.getSectionId("x"),
            this.getSectionId("y"),
          ];

          this.getNewData(
            sliceIds,
            this.getSectionId("color"),
            this.getSectionId("filter"),
            false,
            true // getAssociations
          );
        }
      });
  }

  getStateIdValues = () => {
    const datasetValue: any = {};
    for (const section of sections) {
      datasetValue[section] = this.getSectionId(section);
    }
    return datasetValue;
  };

  getOnSectionChange = (section: Section) => {
    const f = (id: string, links: Array<Link>) => {
      const idValue: any = this.getStateIdValues();
      if (idValue[section] == id) return;
      idValue[section] = id;

      const loadingState: Partial<ControlledPlotState> = {
        tracesAndStatisticsTableIsLoading: true,
      };
      let getAssociations = false;
      if (section == "x") {
        loadingState.associationsIsLoading = true;
        getAssociations = true;
      }

      const loadingStateUpdate: any = {
        id: { $set: id },
        links: { $set: links },
      };
      loadingState[section] = update(this.state[section], loadingStateUpdate);

      if (!this.state.show.allControls && idValue.x != "" && idValue.y != "") {
        loadingState.show = update(this.state.show, {
          allControls: { $set: true },
        });
      }
      if (!this.state.show?.xHasBeenSet && idValue.x != "") {
        loadingState.show = update(this.state.show, {
          xHasBeenSet: { $set: true },
        });
      }
      this.setState(loadingState as ControlledPlotState);
      // get new associations
      // get new plot points

      const sliceIds: string[] = [idValue.x, idValue.y];

      this.getNewData(
        sliceIds,
        idValue.color,
        idValue.filter,
        false,
        getAssociations
      );
    };
    return f;
  };

  swapXY = () => {
    if (this.overrideExists()) {
      // insufficient information to implement (dropdowns are not set for x and y, even though those themselves are not overriden)
      errorHandler.report("swapXY in override mode is not implemented.");
    }

    // value of this.state (of the vector catalogs) is immutable until the event ends
    this.vectorCatalogs.x.setDropdownsState(
      this.vectorCatalogs.y.state.dropdowns
    );
    this.vectorCatalogs.y.setDropdownsState(
      this.vectorCatalogs.x.state.dropdowns
    );

    const newX: SectionState = this.state.y;
    const newY: SectionState = this.state.x;

    const newState: Partial<ControlledPlotState> = {
      // no need to update() for first-level properties
      x: newX,
      y: newY,
    };

    // we need to get points under all circumstances, including if new x is blank, so that we clear the plot
    newState.tracesAndStatisticsTableIsLoading = true;
    newState.associationsIsLoading = true;
    this.setState(newState as ControlledPlotState);

    const sliceIds: string[] = [newX.id, newY.id];

    this.getNewData(
      sliceIds,
      this.getSectionId("color"),
      this.getSectionId("filter"),
      false,
      true
    );
  };

  overrideExists() {
    let section: OverrideSection;
    for (section in this.state.override) {
      if (this.state.override[section] && this.state.override[section] != "") {
        // null and empty string tests
        return true;
      }
    }
    return false;
  }

  getSectionId(section: Section): string {
    // used when you want to get the id, potentially overriden by another component controlling it instead
    if (overrideSections.includes(section as any)) {
      // any explains to typescript that its okay the types isnt the "same" as the array element types
      section = section as OverrideSection; // explaining to typescript
      if (this.state.override[section] && this.state.override[section] != "") {
        // null and empty string tests
        return this.state.override[section];
      }
    }
    return this.state[section].id;
  }

  getNewData(
    sliceIds: string[],
    groupBy: string,
    filter: string,
    computeLinearFit: boolean,
    getAssociations = true
  ) {
    const x = sliceIds && sliceIds.length > 0 ? sliceIds[0] : "";
    const y = sliceIds && sliceIds.length > 1 ? sliceIds[1] : "";

    if (sliceIds && sliceIds.length > 1 && sliceIds[1] != "") {
      computeLinearFit = true;
    }

    // Get primary_disease and cell_line_display_name metadata required for hover info
    if (sliceIds && x != "") {
      sliceIds = sliceIds.concat([
        MetadataIds.primaryDisease,
        MetadataIds.cellLineDisplayName,
        MetadataIds.lineageDisplayName,
      ]);
    }

    this.api
      .getFeaturePlot(
        (sliceIds = sliceIds.filter((feature) => feature.trim() !== "")),
        groupBy,
        filter,
        computeLinearFit
      )
      .then((plotFeatures: PlotFeatures) => {
        if (
          this.getSectionId("x") == x &&
          this.getSectionId("y") == y &&
          this.getSectionId("color") == groupBy &&
          this.getSectionId("filter") == filter
        ) {
          const table = reformatLinRegTable(plotFeatures.linreg_by_group);
          const newState: Partial<ControlledPlotState> = {
            traces: buildTraces(plotFeatures, x, y),
            xLabel: formatAxisLabel(plotFeatures, 0),
            yLabel: formatAxisLabel(plotFeatures, 1),
            table,
            tracesAndStatisticsTableIsLoading: false,
            csvDownloadData: formatCsvDownloadData(plotFeatures),
            csvDownloadFilename: formatCsvDownloadFilename(plotFeatures),
          };
          this.setState(newState as ControlledPlotState);
        } else {
          console.log("mismatched state");
        }
      });
    if (getAssociations) {
      if (x == "") {
        // while we're here, setStates called before getNewData may not have updated state
        const newState: Partial<ControlledPlotState> = {
          associations: {
            data: [],
            associatedDatasets: [],
            datasetLabel: "",
            featureLabel: "",
            id: "",
            checkboxes: [],
          },
          associationsIsLoading: false,
        };
        this.setState(newState as ControlledPlotState);
      } else {
        // 1/25/23: At this point, we expect associations to fail if using bbapi
        // because there is not yet a way to get this data from breadbox
        this.api
          .getAssociations(x)
          .then((associationAndCheckbox: AssociationAndCheckbox) => {
            // be the time we come back, setstates that were called before getNewData will have set the state
            if (this.getSectionId("x") == x) {
              const newState: Partial<ControlledPlotState> = {
                associations: {
                  ...associationAndCheckbox,
                  id: x,
                },
                associationsIsLoading: false,
              };
              this.setState(newState as ControlledPlotState);
            }
          });
      }
    }
  }

  updateShowCheckbox = (event: React.FormEvent<HTMLInputElement>) => {
    const target = event.target as HTMLInputElement;
    const newState: Partial<ControlledPlotState> = {};
    newState.show = update(this.state.show, {
      [target.name]: { $set: target.checked },
    });
    this.setState(newState as ControlledPlotState);
  };

  updateShowAssociation = (event: React.FormEvent<HTMLInputElement>) => {
    this.updateShowCheckbox(event);
    this.state.resizer.enqueueResize(0);
  };

  plotHasPoints = () => {
    return !(
      this.state.traces.length == 0 || this.state.traces[0].label.length == 0
    );
  };

  generatePageUrl = () => {
    if (this.overrideExists()) {
      // the overrides are all transient custom analyses; we hide the button and don't generate urls for them
      errorHandler.report(
        "generatePageUrl in override mode is not implemented."
      );
    }

    const params: Partial<ControlledPlotProps> = {
      filter: this.state.filter.id,
      regressionLine: this.state.show.regressionLine.toString(),
      associationTable: this.state.show.associationTable.toString(),
    };

    // If terminal has been selected, just get the this.state.x.id
    // If it hasn't been, get the last selected dropdown.
    // This lets users generate urls from intermediate selections
    for (const section of sections) {
      if (this.state[section].id == "") {
        let lastNotBlankId = "";
        if (section in this.vectorCatalogs) {
          // e.g. the color dropdown is not initially rendered; its ref does not exist yet
          const { dropdowns } = this.vectorCatalogs[section].state;
          for (let i = dropdowns.length - 1; i >= 0; i--) {
            if (
              dropdowns[i].selected.id != "" &&
              dropdowns[i].selected.id != "isNotFound"
            ) {
              lastNotBlankId = dropdowns[i].selected.id;
              break;
            }
          }
          params[section] = lastNotBlankId;
        }
      } else {
        params[section] = this.state[section].id;
      }
    }

    if (this.props.colors) {
      params.colors = this.props.colors;
    }
    const url: string = encodeUrl(
      params as {
        [key: string]: string;
      }
    );
    const message: string = this.plotHasPoints()
      ? "Copy link:"
      : "This plot has no points. Are you sure you want this?";
    prompt(message, url);
  };

  exportAssociations = () => {
    if (this.state.associations.data.length == 0) {
      alert("Table has no associations");
    } else {
      const params: Partial<ControlledPlotProps> = {
        x: this.getSectionId("x"),
      };
      const url = `${
        window.location.origin + this.api.urlPrefix
      }/interactive/api/associations-csv?${encodeParams(
        params as {
          [key: string]: string;
        }
      )}`;
      window.location.href = url;
    }
  };

  showLmStatsPlot = (entityLabel: string) => {
    console.log("showLmStatsPlot", entityLabel);
  };

  updateDropdownsBySliceId = (sliceId: string, section: Section) => {
    let pathPromise;
    if (sliceId == "") {
      pathPromise = getRootOptionsAsPath(
        "continuous",
        this.context.getVectorCatalogApi
      );
    } else {
      pathPromise = this.context
        .getVectorCatalogApi()
        .getVectorCatalogPath("continuous", sliceId);
    }

    pathPromise.then((path: Array<OptionsInfoSelected>) => {
      if (this.state[section].id == sliceId) {
        const [dropdowns] = formatPathToDropdown(path);
        this.vectorCatalogs[section].setDropdownsState(dropdowns);
      } else {
        console.log("mismatched state");
      }
    });
  };

  updatePlotOnCustomAnalysisClick = (
    sliceId: string,
    colorSliceId: string | undefined,
    filterSlideId: string
  ) => {
    let x;
    let y;
    if (this.state.customAnalysisResult.type == "association") {
      x = this.state.queryVectorId;
      y = sliceId;
    } else if (this.state.customAnalysisResult.type == "two_class") {
      x = sliceId;
      y = undefined; // dont update y, should have been cleared on results complete
    } else {
      errorHandler.report(
        `Unexpected analysis type ${this.state.customAnalysisResult.type}`
      );
    }
    this.updateXandYbySliceIds(x, y, colorSliceId, filterSlideId);
  };

  updateXandYbySliceIds = (
    xSliceId: string | undefined,
    ySliceId: string | undefined,
    colorSliceId: string | undefined,
    filterSliceId: string | undefined
  ) => {
    /**
     * Function used by custom analysis runners to update controlled plot state and get+set plot points
     * Different custom analysis differently provide color and filter ids. They default to null to indicate that null should be passed if they are not used.
     * In this function, only x and y are reflected into controlled plot state. Controlled plot state is NOT set to the provided color or filter
     * The provided color/filter is just used to get plot points
     * That is to say, the state of the provided color/filter slice id resides in the component that calls, not in controlledplot
     * Color/filter on controlled plot state should have already been cleared by a call to onResultsComplete
     */

    const loadingState: Partial<ControlledPlotState> = {};

    if (xSliceId) {
      loadingState.x = update(this.state.x, {
        // set this first even though we set it again when we get path and links, so that if getNewData comes back first it doesn't detect a desync
        id: { $set: xSliceId },
        isDisabled: { $set: true },
      });
      this.setState(loadingState as ControlledPlotState);

      this.context
        .getVectorCatalogApi()
        .getVectorCatalogPath("continuous", xSliceId)
        .then((path: Array<OptionsInfoSelected>) => {
          if (this.state.x.id == xSliceId) {
            const [, sectionUpdates] = formatPathToDropdown(path);
            this.setState({
              x: update(this.state.x, sectionUpdates),
            });
            loadingState.show = update(this.state.show, {
              xHasBeenSet: { $set: true },
            });
          } else {
            console.log("mismatched state x");
          }
        });
    }

    if (ySliceId) {
      loadingState.y = update(this.state.y, {
        // set this first even though we set it again when we get path and links, so that if getNewData comes back first it doesn't detect a desync
        id: { $set: ySliceId },
        isDisabled: { $set: true },
      });
      if (!this.state.show.allControls) {
        loadingState.show = update(this.state.show, {
          allControls: { $set: true },
        });
      }
      loadingState.tracesAndStatisticsTableIsLoading = true;

      this.setState(loadingState as ControlledPlotState);

      this.context
        .getVectorCatalogApi()
        .getVectorCatalogPath("continuous", ySliceId)
        .then((path: Array<OptionsInfoSelected>) => {
          if (this.state.y.id == ySliceId) {
            const [, sectionUpdates] = formatPathToDropdown(path);
            this.setState({
              y: update(this.state.y, sectionUpdates),
            });
          } else {
            console.log("mismatched state y");
          }
        });
    }

    const sliceIds = [xSliceId || this.state.x.id, ySliceId || this.state.y.id];

    this.getNewData(
      sliceIds, // use if provided, else use controlledplot state. for two class, this should have been cleared on results return
      colorSliceId || this.state.color.id, // use if provided, else use controlledplot state
      filterSliceId || this.state.filter.id, // provided as params instead of using the overrides because state may not have been updated yet
      false,
      false // getAssociations
    );
  };

  onAssociationViewClick = (y: string) => {
    if (this.overrideExists()) {
      // don't know how to behave if override exists. Don't know whether to update this.state.y, or coordinate with the overriding component to set this.state.override.y and any other controls
      errorHandler.report(
        "pre-computed associations table click in override mode is not implemented."
      );
    }

    const loadingState: Partial<ControlledPlotState> = {};
    loadingState.y = update(this.state.y, {
      // set this first even though we set it again when we get path and links, so that if getNewData comes back first it doesn't detect a desync
      id: { $set: y },
      isDisabled: { $set: true },
    });
    if (!this.state.show.allControls) {
      loadingState.show = update(this.state.show, {
        allControls: { $set: true },
      });
    }
    loadingState.tracesAndStatisticsTableIsLoading = true;
    this.setState(loadingState as ControlledPlotState);

    this.context
      .getVectorCatalogApi()
      .getVectorCatalogPath("continuous", y)
      .then((path: Array<OptionsInfoSelected>) => {
        if (this.state.y.id == y) {
          const [dropdowns, sectionUpdates] = formatPathToDropdown(path);
          this.vectorCatalogs.y.setDropdownsState(dropdowns);
          this.setState({
            y: update(this.state.y, sectionUpdates),
          });
        } else {
          console.log("mismatched state");
        }
      });

    this.getNewData(
      [this.getSectionId("x"), y],
      this.getSectionId("color"),
      this.getSectionId("filter"),
      false,
      false // getAssociations
    );
  };

  updateSelectedCellLineListName(cellLineList: CustomList) {
    this.setState({ selectedCellLineList: cellLineList });
  }

  hideCustomAnalysisResult = () => {
    this.updateDropdownsBySliceId(this.state.x.id, "x");
    this.updateDropdownsBySliceId(this.state.y.id, "y");
    this.setState({
      showingCustomAnalysis: false,
      numCellLinesUsed: undefined,
      customAnalysisResult: {
        result: undefined,
        type: undefined,
      },
      queryVectorId: undefined,
      // leave queryLimit at whatever it used to be
    });

    // clear all/any overrides
    this.setState({
      override: {
        // get rid of the overrides. could rewrite this to generically set to {}, since we often test for the truthiness of the property
        color: "",
        filter: "",
      },
    });

    const sliceIds: string[] = [
      this.state.x.id, // get from the non-overriden values (don't use getSectionId since state update from clearOverrides may not have taken place yet
      this.state.y.id,
    ];

    this.getNewData(
      sliceIds,
      this.state.color.id,
      this.state.filter.id,
      false,
      true // getAssociations, just in case
    );
  };

  onAssociationResultsComplete = (
    numCellLinesUsed: number,
    result: ComputeResponseResult,
    queryVectorId: string,
    overrideColorState: string,
    overrideFilterState: string,
    analysisType: AnalysisType
  ) => {
    const updatedState: Partial<ControlledPlotState> = {
      numCellLinesUsed,
      showingCustomAnalysis: true,
      queryVectorId,
      customAnalysisResult: {
        result,
        type: analysisType,
      },
      override: {
        // get rid of any previous overrides, unless specified later
        color: "",
        filter: "",
      },
    };

    if (analysisType == "two_class") {
      // disable y
      const loadingState: Partial<ControlledPlotState> = {};
      loadingState.y = update(this.state.y, {
        // set this first even though we set it again when we get path and links, so that if getNewData comes back first it doesn't detect a desync
        id: { $set: "" },
        isDisabled: { $set: true },
      });
      this.setState(loadingState as ControlledPlotState);
      getRootOptionsAsPath("continuous", this.context.getVectorCatalogApi).then(
        (path: Array<OptionsInfoSelected>) => {
          const [, sectionUpdates] = formatPathToDropdown(path);
          this.setState({
            y: update(this.state.y, sectionUpdates),
          });
        }
      );
    }

    if (overrideColorState) {
      updatedState.color = new SectionState();
      if (updatedState.override) {
        updatedState.override.color = overrideColorState;
      }
    }
    if (overrideFilterState) {
      updatedState.filter = new SectionState();
      if (updatedState.override) {
        updatedState.override.filter = overrideFilterState;
      }
    }
    updatedState.show = update(this.state.show, {
      xHasBeenSet: { $set: true },
      associationTable: { $set: false }, // precomputed associations disabled in override mode
    });
    this.setState(updatedState as ControlledPlotState);
    if (this.customAnalysisResult) {
      // might not have been mounted
      this.customAnalysisResult.initResults(); // need to re-initialize, in case there were previous results there
    }
  };

  onToggleCustomTaigaUpload = () => {
    this.setState({ showTaigaUploadModal: !this.state.showTaigaUploadModal });
  };

  onToggleCustomCsvUpload = () => {
    console.log(!this.state.showCsvUploadModal);
    this.setState({ showCsvUploadModal: !this.state.showCsvUploadModal });
  };

  render() {
    if (!this.state.stateInitialized) {
      return <p>Loading...</p>;
    }

    const regressionLine = {
      checked: this.state.show.regressionLine,
      handleChange: this.updateShowCheckbox,
      label: "Show regression line(s)",
      name: "regressionLine",
    };

    const showAssociation = {
      checked: this.state.show.associationTable,
      handleChange: this.updateShowAssociation,
      label: "Show pre-computed associations",
      name: "associationTable",
    };

    const axesOnSameScale = {
      checked: this.state.show.axesOnSameScale,
      handleChange: this.updateShowCheckbox,
      label: "Show x and y axes on the same scale",
      name: "axesOnSameScale",
    };

    const labelHighlightedCellLines = {
      checked: this.state.show.labelHighlightedCellLines,
      handleChange: this.updateShowCheckbox,
      label: "Label cell lines",
      name: "labelHighlightedCellLines",
    };

    const pointsSelected = (points: Array<{ customdata: any }>) => {
      const selectedDepMapIds = points.map(
        (x) => x.customdata.depmap_id
      ) as Array<string>;
      this.setState({ selectedDepMapIds });
    };

    // FIXME (remove type coercion)
    const cellLinesToHighlight = this.state.selectedCellLineList
      .lines as Set<string>;

    // Config for the plot
    const plotProps = {
      xLabel: this.state.xLabel,
      yLabel: this.state.yLabel,
      traces: this.state.traces,
      showRegressionLine: this.state.show.regressionLine,
      showAxesOnSameScale: this.state.show.axesOnSameScale,
      resizer: this.state.resizer,
      cellLinesToHighlight,
      labelHighlightedCellLines: this.state.show.labelHighlightedCellLines,
      onSelect: pointsSelected,
    };

    // Config for association table and checkboxes
    const associationTableProps: ControlledAssociationTableProps = {
      data: this.state.associations.data,
      associatedDatasets: this.state.associations.associatedDatasets,
      onViewClick: this.onAssociationViewClick,
      exportAssociations: this.exportAssociations,
      xDatasetLabel: this.state.associations.datasetLabel,
      xFeatureLabel: this.state.associations.featureLabel,
      resizer: this.state.resizer,
    };

    // includes when plot is empty
    const isTwoAxesMode =
      plotProps.traces.length == 0 || "y" in plotProps.traces[0];

    const showAssociations =
      this.state.show.associationTable && this.getSectionId("x") != "";
    const associationsComputed =
      showAssociations && this.state.associations.associatedDatasets.length > 0;
    const pageLinkSectionProps = {
      sections: [
        this.state.x,
        this.state.y,
        this.state.color,
        this.state.filter,
      ],
    };

    let saveCellLineSet;
    if (
      this.state.selectedDepMapIds &&
      this.state.selectedDepMapIds.length > 0
    ) {
      saveCellLineSet = (name: string) => {
        this.cellLineListStore.add({
          name,
          lines: new Set(this.state.selectedDepMapIds),
        });
      };
    }

    return (
      <div
        className={`controlled-plot ${
          showAssociations
            ? "controlled-plot-three-rows"
            : "controlled-plot-two-rows"
        }`}
      >
        <EndOfSupportBanner className="de1-end-of-support-banner" />
        <div className="header-pane" />
        <div className="controls-pane">
          {!this.state.showingCustomAnalysis && (
            <div className="xy-wrapper">
              <div className="xy-section">
                <div className="label-wrapper">X Axis</div>
                <span
                  className="dropdown-wrapper x-axis"
                  data-selenium-id="x-axis"
                >
                  <VectorCatalog
                    onSelection={this.getOnSectionChange("x")}
                    catalog="continuous"
                    initialDropdowns={this.initialDropdowns.x}
                    ref={(el) => (this.vectorCatalogs.x = el)}
                  />
                </span>
              </div>
              {this.state.show.xHasBeenSet && (
                // separate control from the y axis condition so that we don't have to put them under one parent element, which messes up the css
                <div className="swapxy-wrapper">
                  <SwapXYButton onClick={this.swapXY} />
                </div>
              )}

              <div className="xy-section">
                {this.state.show.xHasBeenSet && (
                  // div is just here to have one parent element
                  <div>
                    <div className="label-wrapper">Y axis</div>
                    <span
                      className="dropdown-wrapper y-axis"
                      data-selenium-id="y-axis"
                    >
                      <VectorCatalog
                        onSelection={this.getOnSectionChange("y")}
                        catalog="continuous"
                        initialDropdowns={this.initialDropdowns.y}
                        ref={(el) => (this.vectorCatalogs.y = el)}
                        isDisabled={this.state.y.isDisabled}
                      />
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          <div>
            {this.props.showCustomAnalysis &&
              this.state.customAnalysisResult.result &&
              this.state.customAnalysisResult.type &&
              this.state.queryLimit && (
                <CustomAnalysisResult
                  Plotly={this.props.Plotly}
                  result={this.state.customAnalysisResult.result}
                  analysisType={this.state.customAnalysisResult.type}
                  queryLimit={this.state.queryLimit}
                  onTableClick={this.updatePlotOnCustomAnalysisClick}
                  hideResult={this.hideCustomAnalysisResult}
                  ref={(el: any) => (this.customAnalysisResult = el)}
                />
              )}
          </div>

          {this.state.show.xHasBeenSet && !this.overrideExists() && (
            <div className="checkbox-wrapper">
              <Checkbox {...showAssociation} />
            </div>
          )}
          <div className="section">
            <span className="button-wrapper">
              <ButtonGroup
                showGenerateUrl={!this.overrideExists()}
                generateUrl={this.generatePageUrl}
                csvDownloadData={this.state.csvDownloadData}
                csvDownloadFilename={this.state.csvDownloadFilename}
                onShowCustomCsv={this.onToggleCustomCsvUpload}
                showCustomTaiga={enabledFeatures.use_taiga_urls}
                onShowCustomTaiga={this.onToggleCustomTaigaUpload}
                showSearchForAssociations={this.props.showCustomAnalysis}
                searchForAssociations={() => {
                  this.setState({ showAssociationsModal: true });
                }}
                saveCellLineSet={saveCellLineSet}
                renderOpenInDE2Button={() =>
                  !this.state.showingCustomAnalysis && (
                    <OpenInDE2Button
                      xSliceId={this.state.x.id}
                      ySliceId={this.state.y.id}
                      colorSliceId={this.state.color.id}
                      filterSliceId={this.state.filter.id}
                      regressionLine={this.state.show.regressionLine}
                    />
                  )
                }
              />
            </span>
          </div>
          {this.plotHasPoints() && (
            <div className="section">
              <span className="button-wrapper">
                <div>
                  <i style={{ color: "red", fontSize: 12 }}>
                    <b>BETA</b>
                  </i>{" "}
                  Use the plot to create a Cell Line Selector group
                </div>
                <div style={{ fontSize: 12 }}>
                  Select the lasso tool in the upper right of the plot. Circle
                  your cell lines. Then click the &quot;Save selected cell
                  lines&quot; button that appears here.
                </div>
              </span>
            </div>
          )}

          {this.state.show.xHasBeenSet && (
            <div>
              <Accordion title="View Options">
                {!this.state.override.color && (
                  <div className="section">
                    <span className="label-wrapper">
                      {isTwoAxesMode ? "Color by" : "Group by"}
                    </span>
                    <span className="dropdown-wrapper">
                      <VectorCatalog
                        onSelection={this.getOnSectionChange("color")}
                        catalog="categorical"
                        initialDropdowns={this.initialDropdowns.color}
                        ref={(el) => (this.vectorCatalogs.color = el)}
                      />
                    </span>
                  </div>
                )}
                {!this.state.override.filter && (
                  <div className="section">
                    <span className="label-wrapper">Filter by</span>
                    <span className="dropdown-wrapper">
                      <VectorCatalog
                        onSelection={this.getOnSectionChange("filter")}
                        catalog="binary"
                        initialDropdowns={this.initialDropdowns.filter}
                        ref={(el) => (this.vectorCatalogs.filter = el)}
                      />
                    </span>
                  </div>
                )}
                <div className="section">
                  <span className="label-wrapper">Find cell lines</span>
                  <span className="button-wrapper">
                    <CellLineListsDropdown
                      onListSelect={this.updateSelectedCellLineListName.bind(
                        this
                      )}
                    />
                    <div className="checkbox-wrapper show-labels-wrapper">
                      <Checkbox {...labelHighlightedCellLines} />
                      <span>Click points to toggle individual labels</span>
                    </div>
                  </span>
                </div>
                <div className="checkbox-wrapper">
                  <Checkbox {...axesOnSameScale} />
                </div>
              </Accordion>
              {this.state.show.allControls && (
                // div needed to have one parent element
                // prefer this to conditioning on the table being empty, since this keeps the accordion open
                <div>
                  <Accordion title="Linear regression">
                    <div className="checkbox-wrapper">
                      <Checkbox {...regressionLine} />
                    </div>
                    <div
                      className={`${
                        this.state.tracesAndStatisticsTableIsLoading
                          ? "disabled"
                          : ""
                      }`}
                    >
                      {this.state.tracesAndStatisticsTableIsLoading && (
                        <Spinner />
                      )}
                      <div
                        style={{
                          overflowX: "auto",
                        }}
                      >
                        {this.state.table && (
                          <StaticTable data={this.state.table} />
                        )}
                      </div>
                    </div>
                  </Accordion>
                </div>
              )}
            </div>
          )}

          {(this.state.x.id != "" || this.state.y.id != "") && (
            <PageLinkAccordion {...pageLinkSectionProps} />
          )}
        </div>
        <div
          className={`main-plot-pane ${
            this.state.tracesAndStatisticsTableIsLoading ? "disabled" : ""
          }`}
        >
          {this.state.tracesAndStatisticsTableIsLoading && <Spinner />}
          <Plot Plotly={this.props.Plotly} {...plotProps} />
        </div>

        {showAssociations && (
          <div className="association-table-pane-full-width">
            <div className="bottom-row-oriented">
              {associationsComputed && (
                <div
                  className={`pad-sides ${
                    this.state.associationsIsLoading ? "disabled" : ""
                  }`}
                >
                  {this.state.associationsIsLoading && <Spinner />}
                  <ControlledAssociationTable
                    {...associationTableProps}
                    key={this.state.associations.id}
                  />
                </div>
              )}
              {!associationsComputed && (
                <div
                  className={`pad-sides ${
                    this.state.associationsIsLoading ? "disabled" : ""
                  }`}
                  style={{ height: "300px" }}
                >
                  {this.state.associationsIsLoading && <Spinner />}
                  Correlations were not computed for{" "}
                  {this.state.associations.datasetLabel}
                </div>
              )}
            </div>
          </div>
        )}
        <UserUploadModal
          show={this.state.showTaigaUploadModal}
          onHide={this.onToggleCustomTaigaUpload}
          uploadFormat={UploadFormat.Taiga}
          isPrivate={false}
          isTransient
          taskKickoffFunction={this.api.postCustomTaiga}
          getTaskStatus={(taskId: string) => this.api.getTaskStatus(taskId)}
        />
        <UserUploadModal
          show={this.state.showCsvUploadModal}
          onHide={this.onToggleCustomCsvUpload}
          uploadFormat={UploadFormat.File}
          isPrivate={false}
          isTransient
          taskKickoffFunction={this.api.postCustomCsv}
          getTaskStatus={(taskId: string) => this.api.getTaskStatus(taskId)}
        />
      </div>
    );
  }
}
