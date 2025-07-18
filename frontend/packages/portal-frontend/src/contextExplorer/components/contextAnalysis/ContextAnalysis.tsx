import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cached, legacyPortalAPI } from "@depmap/api";
import { toPortalLink } from "@depmap/globals";
import {
  ContextAnalysisTableType,
  ContextExplorerDatasets,
  ContextNameInfo,
  ContextNode,
  ContextPlotBoxData,
} from "@depmap/types";
import styles from "src/contextExplorer/styles/ContextExplorer.scss";
import {
  ContextAnalysisPlotData,
  ContextAnalysisPlotType,
  TreeType,
} from "../../models/types";
import {
  LEGEND_ALL,
  DEFAULT_PALETTE,
  LEGEND_RANGE_1,
  LEGEND_RANGE_2,
  LEGEND_RANGE_3,
  LEGEND_RANGE_4,
  LEGEND_RANGE_5,
  LEGEND_RANGE_6,
  LegendKey,
  LEGEND_RANGE_7,
} from "@depmap/data-explorer-2";
import ContextAnalysisPlotPanel from "./ContextAnalysisPlotPanel";
import ScatterPlotLegend from "./ScatterPlotLegend";
import {
  getDataExplorerUrl,
  OUTGROUP_TYPE_ALL_OPTION,
  BLOOD_LINEAGES,
  getBoxPlotFilterVariables,
  getSelectivityValLabel,
  getShowPositiveEffectSizesFilter,
  GENE_DEP_TABLE_DESCRIPTION,
  GENE_DETAIL_NO_GENE_SELECTED,
  ONCREF_DETAIL_NO_COMPOUND_SELECTED,
  REPURPOSING_DETAIL_NO_COMPOUND_SELECTED,
  ONCREF_TABLE_DESCRIPTION,
  REPURPOSING_TABLE_DESCRIPTION,
  getDetailPanelTooltip,
} from "../../utils";
import geneDepFilterDefinitions from "../../json/geneDepFilters.json";
import repurposingFilterDefinitions from "../../json/repurposingFilters.json";
import oncrefFilterDefinitions from "../../json/oncrefFilters.json";
import Select from "react-select";
import filterLayoutGene from "../../json/filterLayoutGene.json";
import filterLayoutDrug from "../../json/filterLayoutDrug.json";
import { satisfiesFilters } from "src/common/models/discoveryAppFilters";
import ContextAnalysisTable from "./ContextAnalysisTable";
import FilterInputGroup from "src/common/components/FilterControls/FilterInputGroup";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { Button } from "react-bootstrap";
import useContextExplorerFilters from "src/contextExplorer/hooks/useContextExplorerFilters";
import DoseCurvesTile from "./DoseCurvesTile";
import CollapsibleBoxPlots from "../boxPlots/CollapsibleBoxPlots";
import { calcMinMax } from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/plotUtils";
import InfoIcon from "src/common/components/InfoIcon";

interface ContextAnalysisProps {
  selectedContextNameInfo: ContextNameInfo;
  selectedContextNode: ContextNode | null;
  topContextNameInfo: ContextNameInfo;
  treeType: TreeType;
  entityType: string;
  datasetId: ContextExplorerDatasets;
  customInfoImg: React.JSX.Element;
}

function ContextAnalysis({
  selectedContextNameInfo,
  selectedContextNode,
  topContextNameInfo,
  treeType,
  entityType,
  datasetId,
  customInfoImg,
}: ContextAnalysisProps) {
  const [outgroup, setOutgroup] = useState<{
    value: string;
    label: string;
  }>(OUTGROUP_TYPE_ALL_OPTION);
  const [outgroupOptions, setOutgroupOptions] = useState<
    {
      value: string;
      label: string;
    }[]
  >([]);
  const [didValidateOutgroup, setDidValidateOutgroup] = useState<boolean>(
    false
  );

  const handleOutGroupChanged = useCallback(
    (selection: { value: string; label: string }) => {
      setOutgroup(selection);
    },
    [setOutgroup]
  );

  useEffect(() => {
    const outGroupOpts: { value: string; label: string }[] = [];

    // All other cell lines
    outGroupOpts.push(OUTGROUP_TYPE_ALL_OPTION);

    selectedContextNode?.path.forEach(async (subtype_code) => {
      if (subtype_code !== selectedContextNode.subtype_code) {
        const nodeName = await legacyPortalAPI.getNodeName(subtype_code);
        outGroupOpts.push({
          value: subtype_code,
          label: `Other ${nodeName}`,
        });
      }
    });

    if (
      BLOOD_LINEAGES.includes(topContextNameInfo.name) ||
      BLOOD_LINEAGES.includes(topContextNameInfo.subtype_code)
    ) {
      outGroupOpts.push({
        value: "Other Heme",
        label: "Other Heme",
      });
    }
    setOutgroupOptions(outGroupOpts);
  }, [topContextNameInfo, selectedContextNode, selectedContextNameInfo.name]);

  useEffect(() => {
    const outgroupLabels = outgroupOptions.map((outgr) => outgr.label);

    if (!outgroupLabels.includes(outgroup.label)) {
      const newOutgroup = outgroupOptions.filter(
        (opt) => opt.value === outgroup.label
      );

      // If the context was switched from a primary disease to a lineage, not all of
      // the outgroup options apply anymore. For example, if Ewings Sarcoma is selected,
      // outgroup might be {value: OutgroupType.Lineage, Label: "Other Bone"}. If the context selection
      // is switched to a Lineage, there is no OutgroupType.Lineage. So set outgroup to All other cell lines.
      if (newOutgroup.length === 0) {
        setOutgroup(OUTGROUP_TYPE_ALL_OPTION);
      } else {
        setOutgroup({
          value: newOutgroup[0].value,
          label: newOutgroup[0].label,
        });
      }
    }
    setDidValidateOutgroup(true);
  }, [outgroup, outgroupOptions]);

  const [data, setData] = useState<ContextAnalysisTableType | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const latestPromise = useRef<Promise<ContextAnalysisTableType> | null>(null);

  useEffect(() => {
    setData(null);
    if (didValidateOutgroup) {
      setIsLoading(true);
      const promise = legacyPortalAPI.getContextExplorerAnalysisData(
        selectedContextNameInfo.subtype_code,
        outgroup.value,
        entityType,
        datasetId
      );

      latestPromise.current = promise;
      promise
        .then((fetchedData) => {
          if (promise === latestPromise.current) {
            setData(fetchedData);
          }
        })
        .catch((e) => {
          if (promise === latestPromise.current) {
            window.console.error(e);
            setError(true);
            setIsLoading(false);
          }
        })
        .finally(() => {
          if (promise === latestPromise.current) {
            setIsLoading(false);
          }
        });
      setDidValidateOutgroup(false);
    }
  }, [
    setData,
    setIsLoading,
    selectedContextNameInfo.name,
    selectedContextNameInfo.subtype_code,
    outgroup,
    datasetId,
    entityType,
    treeType,
    didValidateOutgroup,
  ]);

  const [plotData, setPlotData] = useState<ContextAnalysisPlotData | null>(
    null
  );

  // When a plot point is selected, filter the table down to that single row via
  // using the array to determine pointVisbility. If a plot point is not selected, this
  // should always be null.
  const [pointVisibilityFiltered, setPointVisibilityFiltered] = useState<
    boolean[] | null
  >(null);

  const [
    selectedPlotLabels,
    setSelectedPlotLabels,
  ] = useState<Set<string> | null>(null);
  const [
    selectedTableLabels,
    setSelectedTableLabels,
  ] = useState<Set<string> | null>(null);

  const [
    tTestPlotElement,
    setTTestPlotElement,
  ] = useState<ExtendedPlotType | null>(null);
  const [
    inVsOutPlotElement,
    setInVsOutPlotElement,
  ] = useState<ExtendedPlotType | null>(null);

  // TODO: In the future, we should take stickyFiltersMode out since it's always turned off. The decision
  // to turn this off was made right before the 24q4 release, so it was decided that it's temporarily less risky to
  // turn off the stickyFiltersMode instead of completely removing the ability to set stickyFiltersMode.
  const stickyFiltersMode = false; // DO NOT CHANGE THIS TO TRUE.

  // useContextExplorerFilters is very similar to useDiscoveryAppFilters. They
  // are temporarily separated out into 2 different files while the stickyFiltersMode
  // and Context Explorer is new. This is to reduce the risk of breaking Context Explorer,
  // TDA, and Compound Dashboard all at once.

  const getFilterDefinitions = useCallback(() => {
    if (datasetId === ContextExplorerDatasets.Prism_oncology_AUC) {
      return oncrefFilterDefinitions;
    }

    if (datasetId === ContextExplorerDatasets.Rep_all_single_pt) {
      return repurposingFilterDefinitions;
    }

    return geneDepFilterDefinitions;
  }, [datasetId]);

  const {
    transientFilterState,
    filters,
    updateFilter,
    resetFilters,
    changedFilters,
    defaultFilters,
  } = useContextExplorerFilters(
    data,
    getFilterDefinitions(),
    stickyFiltersMode
  );

  const [pointVisibility, setPointVisibility] = useState<boolean[]>([]);

  useEffect(() => {
    setSelectedPlotLabels(null);
    setSelectedTableLabels(null);
    setPointVisibilityFiltered(null);
  }, [selectedContextNameInfo, topContextNameInfo]);

  const [
    doShowPositiveEffectSizes,
    setDoShowPositiveEffectSizes,
  ] = useState<boolean>(false);

  useEffect(() => {
    const newPointVisibility =
      filters && data ? satisfiesFilters(filters, data) : [];
    setPointVisibility(newPointVisibility);

    if (
      filters &&
      data &&
      doShowPositiveEffectSizes === true &&
      getShowPositiveEffectSizesFilter(filters) === false
    ) {
      setSelectedPlotLabels(null);
      setSelectedTableLabels(null);
    }
  }, [data, filters, doShowPositiveEffectSizes]);

  const formatDataForScatterPlot = useCallback(
    (tableData: ContextAnalysisTableType) => {
      const getDrugXAxisLabel = () => {
        if (datasetId === ContextExplorerDatasets.Prism_oncology_AUC) {
          // Keep this as AUC regardless of what the units of Prism_oncology_AUC are because
          // get_context_analysis outputs these results and should always use AUC (rather than log2(AUC))
          return `In-context mean AUC`;
        }

        return "In-context mean log2(viability)";
      };

      const getDrugYAxisLabel = () => {
        if (datasetId === ContextExplorerDatasets.Prism_oncology_AUC) {
          return `Out-group mean AUC`;
        }
        return "Out-group mean log2(viability)";
      };

      const entityLabels: string[] = [];
      const selectivityVal: number[] = [];
      const tTestXVals: number[] = [];
      const tTestYVals: number[] = [];
      const inVsOutXVals: number[] = [];
      const inVsOutYVals: number[] = [];

      tableData.entity.forEach((entity, i) => {
        entityLabels.push(entity);
        selectivityVal.push(tableData.selectivity_val[i]);
        tTestXVals.push(tableData.effect_size[i]);
        tTestYVals.push(tableData.t_qval_log[i]);
        inVsOutXVals.push(tableData.mean_in[i]);
        inVsOutYVals.push(tableData.mean_out[i]);
      });
      return {
        indexLabels: entityLabels,
        selectivityVal,
        tTest: {
          x: {
            axisLabel: "Effect size (difference in means)",
            values: tTestXVals,
          },
          y: {
            axisLabel: "T-test -log(q-value)",
            values: tTestYVals,
          },
        },
        inVsOut: {
          x: {
            axisLabel:
              entityType === "gene"
                ? "In-group mean gene effect"
                : getDrugXAxisLabel(),
            values: inVsOutXVals,
          },
          y: {
            axisLabel:
              entityType === "gene"
                ? "Out-group mean gene effect"
                : getDrugYAxisLabel(),
            values: inVsOutYVals,
          },
        },
      };
    },
    [entityType, datasetId]
  );

  const formattedScatterPlotData = useMemo(
    () => () => (data ? formatDataForScatterPlot(data) : null),
    [data, formatDataForScatterPlot]
  );

  useEffect(() => {
    setTTestPlotElement(null);
    setInVsOutPlotElement(null);
    setPlotData(formattedScatterPlotData);
  }, [formattedScatterPlotData, setPlotData]);

  const handleClickRowAndPoint = useCallback(
    (pointIndex: number) => {
      if (plotData && plotData.indexLabels) {
        const label = plotData?.indexLabels[pointIndex];

        setSelectedPlotLabels((xs) => {
          let ys = new Set(xs);

          if (xs?.has(label)) {
            ys.delete(label);
            setPointVisibilityFiltered(null);
          } else {
            if (xs && xs?.size > 0) {
              ys = new Set();
            }
            ys.add(label);

            // Filter the table to 1 row so the user doesn't have to
            // scroll to find the row corresponding to the point they just selected.
            const filteredVisibility = Array(plotData.indexLabels.length).fill(
              false
            );

            filteredVisibility[pointIndex] = true;
            setPointVisibilityFiltered(filteredVisibility);
          }

          return ys;
        });

        setSelectedTableLabels((xs) => {
          let ys = new Set(xs);

          if (xs?.has(label)) {
            ys.delete(label);
          } else {
            if (xs && xs?.size > 0) {
              ys = new Set();
            }
            ys.add(label);
          }

          return ys;
        });
      }
    },
    [
      plotData,
      setSelectedPlotLabels,
      setSelectedTableLabels,
      setPointVisibilityFiltered,
    ]
  );

  const handleSelectRowAndPoint = useCallback(
    (entityLabel: string) => {
      if (plotData && plotData.indexLabels) {
        const label = entityLabel;

        setSelectedTableLabels((xs) => {
          let ys = new Set(xs);

          if (!label) {
            return new Set();
          }

          if (xs?.has(label)) {
            ys.delete(label);
          } else {
            if (xs && xs?.size > 0) {
              ys = new Set();
            }
            ys.add(label);
          }

          return ys;
        });

        setPointVisibilityFiltered(null);

        setSelectedPlotLabels((xs) => {
          let ys = new Set(xs);

          if (!label) {
            return new Set();
          }

          if (xs?.has(label)) {
            ys.delete(label);
          } else {
            if (xs && xs?.size > 0) {
              ys = new Set();
            }
            ys.add(label);
          }

          return ys;
        });
      }
    },
    [
      plotData,
      setSelectedPlotLabels,
      // setSelectedPlotIndex,
      setSelectedTableLabels,
      // setSelectedTableIndex,
      setPointVisibilityFiltered,
    ]
  );

  const handleSetSelectedPlotLabels = useCallback(
    (labels: Set<string> | null) => {
      setSelectedPlotLabels(labels);
    },
    [setSelectedPlotLabels]
  );

  const getLogOrColorScale = (min: number, max: number) => {
    const zeroPosition = Math.abs((0 - min) / (max - min));
    const scale = [
      ["0.0", "#0000FF"], // Blue to label Depletions (points with the most negative log(OR)
      [zeroPosition.toString(), "#DDDCDC"],
      ["1.0", "#FF0000"], // Red to label Enrichments (points with the most positive log(OR))
    ];

    return scale;
  };

  const continuousColorScale = useMemo(() => {
    const values = plotData?.selectivityVal;
    if (!values) {
      return undefined;
    }

    if (entityType === "gene") {
      const { min, max } = calcMinMax(values);
      const scale = getLogOrColorScale(min, max);

      return scale;
    }

    const scale = [
      ["0", "#01153e"],
      ["0.25", "#1873d3"],
      ["0.5", "#00827d"],
      ["0.75", "#00c06e"],
      ["0.85", "#ccff00"],
      ["1", "#ccff00"],
    ];

    return scale;
  }, [plotData, entityType]);

  const getBins = useCallback(
    (
      legendMin: number,
      legendMax: number,
      legendRange: number,
      binNumber: number
    ) => {
      let binStart = legendMin;
      const legendBinSize = legendRange / binNumber;

      const bins = [];
      for (let i = 0; i < binNumber; i += 1) {
        const binEnd =
          i === binNumber - 1 ? legendMax : binStart + legendBinSize;
        bins.push([binStart, binEnd]);
        binStart = binEnd;
      }

      return bins;
    },
    []
  );

  const calcColorByBins = useCallback(
    (values: number[]) => {
      if (values.length === 0) {
        return null;
      }

      const { min, max } = calcMinMax(values);
      console.log(min);
      if (entityType !== "gene") {
        const binNumber = 5;
        const legendMin = 0;
        const legendMax = max;
        const legendRange = legendMax - legendMin;
        const bins = getBins(legendMin, legendMax, legendRange, binNumber);
        return {
          [LEGEND_RANGE_1]: bins[0],
          [LEGEND_RANGE_2]: bins[1],
          [LEGEND_RANGE_3]: bins[2],
          [LEGEND_RANGE_4]: bins[3],
          [LEGEND_RANGE_5]: bins[4],
        };
      }
      const binNumber = 7;
      const legendMin = -2;
      const legendMax = 2;
      const legendRange = legendMax + Math.abs(legendMin);

      const bins = getBins(legendMin, legendMax, legendRange, binNumber);

      return {
        [LEGEND_RANGE_1]: bins[0],
        [LEGEND_RANGE_2]: bins[1],
        [LEGEND_RANGE_3]: bins[2],
        [LEGEND_RANGE_4]: bins[3],
        [LEGEND_RANGE_5]: bins[4],
        [LEGEND_RANGE_6]: bins[5],
        [LEGEND_RANGE_7]: bins[6],
      };
    },
    [entityType, getBins]
  );

  const continuousBins = useMemo(
    () => (plotData ? calcColorByBins(plotData.selectivityVal) : null),
    [plotData, calcColorByBins]
  );

  const colorMap = useMemo(() => {
    if (!plotData?.selectivityVal || !continuousColorScale) {
      return {
        [LEGEND_ALL]: DEFAULT_PALETTE.all,
      };
    }

    if (plotData?.selectivityVal.length === 0) {
      return {
        [LEGEND_ALL]: DEFAULT_PALETTE.all,
      };
    }

    let colorM: Partial<Record<LegendKey, string>> = {};

    colorM =
      entityType === "gene"
        ? {
            [LEGEND_RANGE_1]: continuousColorScale[0][1],
            [LEGEND_RANGE_2]: "#BCD0F5",
            [LEGEND_RANGE_3]: "#BCD0F5",
            [LEGEND_RANGE_4]: continuousColorScale[1][1],
            [LEGEND_RANGE_5]: "#EDC5AF",
            [LEGEND_RANGE_6]: "#EDC5AF",
            [LEGEND_RANGE_7]: continuousColorScale[2][1],
          }
        : {
            [LEGEND_RANGE_1]: continuousColorScale[0][1],
            [LEGEND_RANGE_2]: continuousColorScale[1][1],
            [LEGEND_RANGE_3]: continuousColorScale[2][1],
            [LEGEND_RANGE_4]: continuousColorScale[3][1],
            [LEGEND_RANGE_5]: continuousColorScale[4][1],
          };

    return colorM;
  }, [plotData?.selectivityVal, continuousColorScale, entityType]);

  const [boxPlotData, setBoxPlotData] = useState<ContextPlotBoxData | null>(
    null
  );

  const [isLoadingBoxplot, setIsLoadingBoxplot] = useState<boolean>(true);

  const [boxPlotMaxFDR, setBoxPlotMaxFDR] = useState<number | undefined>(
    undefined
  );
  const [boxPlotMinEffectSize, setBoxPlotMinEffectSize] = useState<
    number | undefined
  >(undefined);
  const [boxPlotMinFracDepIn, setBoxPlotMinFracDepIn] = useState<
    number | undefined
  >(undefined);

  useEffect(() => {
    if (
      filters &&
      selectedPlotLabels &&
      selectedPlotLabels.size > 0 &&
      [...selectedPlotLabels][0]
    ) {
      const boxPlotFilters = defaultFilters.current || filters;

      const { maxFdr, minEffectSize, minFracDepIn } = getBoxPlotFilterVariables(
        boxPlotFilters
      );

      const showPositiveEffectSizes = getShowPositiveEffectSizesFilter(filters);
      setDoShowPositiveEffectSizes(showPositiveEffectSizes);
      setBoxPlotMaxFDR(maxFdr);
      setBoxPlotMinEffectSize(minEffectSize);
      setBoxPlotMinFracDepIn(minFracDepIn);
    }
  }, [filters, selectedPlotLabels, defaultFilters]);

  const [boxplotError, setBoxplotError] = useState(false);
  const boxplotLatestPromise = useRef<Promise<ContextPlotBoxData> | null>(null);

  useEffect(() => {
    if (
      selectedPlotLabels &&
      selectedPlotLabels.size > 0 &&
      [...selectedPlotLabels][0] &&
      boxPlotMaxFDR &&
      boxPlotMinEffectSize &&
      boxPlotMinFracDepIn
    ) {
      setBoxPlotData(null);
      // setEntityDetailMainPlotElement(null);
      setIsLoadingBoxplot(true);
      setBoxplotError(false);
      const boxplotPromise = cached(
        legacyPortalAPI
      ).getContextExplorerBoxPlotData(
        selectedContextNameInfo.subtype_code,
        treeType,
        datasetId,
        entityType,
        [...selectedPlotLabels][0],
        boxPlotMaxFDR,
        boxPlotMinEffectSize,
        boxPlotMinFracDepIn,
        doShowPositiveEffectSizes
      );

      boxplotLatestPromise.current = boxplotPromise;

      boxplotPromise
        .then((dataVals) => {
          if (boxplotPromise === boxplotLatestPromise.current) {
            setBoxPlotData(dataVals);
          }
        })
        .catch((e) => {
          if (boxplotPromise === boxplotLatestPromise.current) {
            window.console.error(e);
            setBoxplotError(true);
          }
        })
        .finally(() => setIsLoadingBoxplot(false));
    }
  }, [
    setIsLoadingBoxplot,
    selectedContextNameInfo,
    outgroup,
    datasetId,
    selectedPlotLabels,
    entityType,
    treeType,
    topContextNameInfo,
    boxPlotMaxFDR,
    boxPlotMinEffectSize,
    boxPlotMinFracDepIn,
    doShowPositiveEffectSizes,
  ]);

  return (
    <div className={styles.geneDepPage}>
      <section className={styles.plotContainer}>
        <div className={styles.overviewGraphHeader}>
          {selectedContextNameInfo.name !== "All" && data && (
            <>
              {entityType === "gene" && (
                <>
                  <h2>
                    Dependencies enriched in {selectedContextNameInfo.name}
                  </h2>
                  <h4>
                    The plots below display gene dependencies that are enriched
                    in {selectedContextNameInfo.name} models compared to{" "}
                    {outgroup.label.toLowerCase()} models.
                  </h4>
                </>
              )}
              {datasetId === ContextExplorerDatasets.Prism_oncology_AUC && (
                <>
                  <h2>
                    OncRef sensitivies enriched in{" "}
                    {selectedContextNameInfo.name}
                  </h2>
                  <h4>
                    The plots below display compound sensitivities that are
                    enriched in {selectedContextNameInfo.name} models compared
                    to {outgroup.label.toLowerCase()} models.
                  </h4>
                </>
              )}
              {datasetId === ContextExplorerDatasets.Rep_all_single_pt && (
                <>
                  <h2>
                    PRISM Repurposing compound sensitivities enriched in{" "}
                    {selectedContextNameInfo.name}
                  </h2>
                  <h4>
                    The plots below display compound sensitivities that are
                    enriched in {selectedContextNameInfo.name} models compared
                    to {outgroup.label.toLowerCase()} models.
                  </h4>
                </>
              )}
            </>
          )}{" "}
          {error && (
            <div className={styles.initialLoadError}>
              <h1>Sorry, an error occurred</h1>
              <p>There was an error loading these plots.</p>
            </div>
          )}
          {!error && !isLoading && selectedContextNameInfo.name === "All" ? (
            <div style={{ height: "100vh" }}>
              <h1 style={{ textAlign: "center", color: "#808080" }}>
                Select A More Specific Context
              </h1>
            </div>
          ) : (
            !error &&
            !isLoading &&
            !data && (
              <>
                {entityType === "gene" && (
                  <h2>
                    Not enough data points to compute enriched dependencies for
                    {selectedContextNameInfo.name}. Enriched dependencies are
                    only computed for lineages/subtypes with at least 5 CRISPR
                    screened models.
                  </h2>
                )}
                {datasetId === ContextExplorerDatasets.Prism_oncology_AUC && (
                  <h2>
                    Not enough data points to compute enriched PRISM OncRef
                    compound sensitivities for {selectedContextNameInfo.name}.
                    Enriched compound sensitivities are only computed for
                    lineages/subtypes with at least 5 PRISM OncRef models.
                  </h2>
                )}
                {datasetId === ContextExplorerDatasets.Rep_all_single_pt && (
                  <h2>
                    Not enough data points to compute enriched PRISM Repurposing
                    compound sensitivities for {selectedContextNameInfo.name}.
                    Enriched compound sensitivities are only computed for
                    lineages/subtypes with at least 5 PRISM Repurposing models.
                  </h2>
                )}
              </>
            )
          )}
        </div>
        <div className={styles.ContextExplorerScatterPlots}>
          <div className={styles.plotControls}>
            {selectedContextNameInfo.name !== "All" && (
              <div className={styles.outgroupSelectorContainer}>
                <div className={styles.outgroupSelector}>
                  <span
                    style={{
                      fontSize: "16px",
                      color: "#000000",
                      display: "flex",
                      flexDirection: "column",
                      flexGrow: 1,
                    }}
                  >
                    Out-group{" "}
                  </span>
                  <Select
                    defaultValue={OUTGROUP_TYPE_ALL_OPTION}
                    value={outgroup}
                    isDisabled={selectedContextNameInfo.name === "All"}
                    options={outgroupOptions}
                    onChange={(value: any) => {
                      if (value) {
                        handleOutGroupChanged(value);
                        handleSetSelectedPlotLabels(null);
                      }
                    }}
                    id="context-explorer-outgroup-selection"
                  />
                </div>
              </div>
            )}
            {continuousBins && selectedContextNameInfo.name !== "All" && (
              <ScatterPlotLegend
                legendTitle={getSelectivityValLabel(entityType)}
                colorMap={colorMap}
                continuousBins={continuousBins}
                legendKeysWithNoData={null}
              />
            )}
          </div>
          {selectedContextNameInfo.name !== "All" && (
            <div className={styles.plots}>
              <div className={styles.leftPlot}>
                {!error &&
                  (!tTestPlotElement || !inVsOutPlotElement || isLoading) && (
                    <PlotSpinner />
                  )}
                {!error && (
                  <ContextAnalysisPlotPanel
                    data={plotData ?? null}
                    plot={tTestPlotElement}
                    plotType={ContextAnalysisPlotType.TTest}
                    pointVisibility={
                      plotData && pointVisibility.length === 0
                        ? plotData.selectivityVal.map(() => true)
                        : pointVisibility
                    }
                    handleClickPoint={handleClickRowAndPoint}
                    handleSetSelectedLabels={handleSetSelectedPlotLabels}
                    handleSetPlotElement={(
                      element: ExtendedPlotType | null
                    ) => {
                      setTTestPlotElement(element);
                    }}
                    selectedPlotLabels={selectedPlotLabels}
                    colorScale={continuousColorScale}
                    isLoading={isLoading}
                    entityType={entityType}
                    showYEqualXLine={false}
                  />
                )}
              </div>
              <div className={styles.rightPlot}>
                {!error &&
                  (!tTestPlotElement || !inVsOutPlotElement || isLoading) && (
                    <PlotSpinner />
                  )}
                {!error && (
                  <ContextAnalysisPlotPanel
                    data={plotData}
                    plot={inVsOutPlotElement}
                    plotType={ContextAnalysisPlotType.inVsOut}
                    pointVisibility={
                      plotData && pointVisibility.length === 0
                        ? plotData.selectivityVal.map(() => true)
                        : pointVisibility
                    }
                    handleClickPoint={handleClickRowAndPoint}
                    handleSetSelectedLabels={handleSetSelectedPlotLabels}
                    handleSetPlotElement={(
                      element: ExtendedPlotType | null
                    ) => {
                      setInVsOutPlotElement(element);
                    }}
                    selectedPlotLabels={selectedPlotLabels}
                    colorScale={continuousColorScale}
                    isLoading={isLoading}
                    entityType={entityType}
                    showYEqualXLine
                  />
                )}
              </div>
            </div>
          )}
          {selectedContextNameInfo.name !== "All" && (
            <div className={styles.deButtonRow}>
              <div className={styles.deButtonOffset} />
              <div className={styles.deButtonContainer}>
                <Button
                  className={styles.deButton}
                  href={getDataExplorerUrl(
                    selectedContextNameInfo.subtype_code,
                    outgroup,
                    datasetId
                  )}
                  target="_blank"
                  disabled={
                    selectedContextNameInfo.name === "All" ||
                    (!isLoading && !data)
                  }
                >
                  Open This Plot in Data Explorer
                </Button>
              </div>
            </div>
          )}
          {selectedContextNameInfo.name !== "All" && !isLoading && data && (
            <div className={styles.geneDepTable}>
              <hr
                style={{
                  borderTop: "1px solid #7d7d7d",
                }}
              />
              <h3>
                Table and Scatter Plot Filters{" "}
                <span>
                  <button
                    type="button"
                    className={styles.resetButton}
                    onClick={resetFilters}
                  >
                    reset all
                  </button>
                </span>
              </h3>

              {entityType === "gene" && (
                <p
                  style={{
                    fontSize: "14px",
                    paddingRight: "35px",
                    maxWidth: "750px",
                  }}
                >
                  {GENE_DEP_TABLE_DESCRIPTION}
                </p>
              )}
              {datasetId === ContextExplorerDatasets.Prism_oncology_AUC && (
                <p
                  style={{
                    fontSize: "14px",
                    paddingRight: "35px",
                    maxWidth: "750px",
                  }}
                >
                  {ONCREF_TABLE_DESCRIPTION}
                </p>
              )}
              {datasetId === ContextExplorerDatasets.Rep_all_single_pt && (
                <p
                  style={{
                    fontSize: "14px",
                    paddingRight: "35px",
                    maxWidth: "750px",
                  }}
                >
                  {REPURPOSING_TABLE_DESCRIPTION}
                </p>
              )}
              <div
                className={
                  selectedContextNameInfo.name === "All"
                    ? styles.disabledFilters
                    : styles.geneDepFilters
                }
              >
                <FilterInputGroup
                  // eslint-disable-next-line react/no-array-index-key
                  key="gene-dep-plot-filters"
                  data={data}
                  group={
                    entityType === "gene"
                      ? filterLayoutGene[0].groups[0]
                      : filterLayoutDrug[0].groups[0]
                  }
                  filters={transientFilterState}
                  onChangeFilter={updateFilter}
                  hasChanges={
                    entityType === "gene"
                      ? filterLayoutGene[0].groups[0].keys.some(
                          (key: any) => changedFilters.indexOf(key) > -1
                        )
                      : filterLayoutDrug[0].groups[0].keys.some(
                          (key: any) => changedFilters.indexOf(key) > -1
                        )
                  }
                  altStyle={styles}
                  selectedColor={"#a8529d66"}
                  disableHistogram
                />
              </div>
              <ContextAnalysisTable
                data={data}
                pointVisibility={pointVisibilityFiltered ?? pointVisibility}
                handleSelectRowAndPoint={handleSelectRowAndPoint}
                selectedTableLabels={selectedTableLabels}
                entityType={entityType}
                datasetId={datasetId}
              />
            </div>
          )}
        </div>
      </section>
      <div className={styles.right}>
        {selectedPlotLabels && selectedPlotLabels.size > 0 && (
          <>
            <h2
              style={{
                marginBottom: "0",
                fontFamily: "Lato",
                fontSize: "24px",
                fontWeight: "bold",
              }}
            >
              {entityType === "gene" ? "Gene" : "Drug"} Detail
              {selectedPlotLabels && (
                <span>
                  {" "}
                  - {selectedPlotLabels}{" "}
                  <InfoIcon
                    target={customInfoImg}
                    popoverContent={getDetailPanelTooltip(datasetId)}
                    popoverId={`${datasetId}-detail-popover`}
                    trigger={["hover", "focus"]}
                    placement={"top"}
                  />
                </span>
              )}
            </h2>
            {boxPlotData && (
              <a
                href={toPortalLink(
                  `/${entityType}/${boxPlotData.entity_overview_page_label}`
                )}
                target="_blank"
                rel="noreferrer"
                style={{
                  textDecoration: "underline",
                  marginTop: "0",
                  marginBottom: "25px",
                }}
              >
                Go to {entityType} page
              </a>
            )}
          </>
        )}
        {selectedPlotLabels &&
          selectedPlotLabels.size > 0 &&
          datasetId === ContextExplorerDatasets.Prism_oncology_AUC &&
          !isLoading &&
          data && (
            <div className={styles.plotFrame}>
              <DoseCurvesTile
                subtypeCode={selectedContextNameInfo.subtype_code}
                selectedLevel={selectedContextNameInfo.node_level}
                selectedContextName={selectedContextNameInfo.name}
                selectedDrugLabel={[...selectedPlotLabels][0]}
                datasetName={datasetId}
                selectedOutGroupType={outgroup.value}
                selectedTreeType={treeType}
                getContextExplorerDoseResponsePoints={
                  cached(legacyPortalAPI).getContextExplorerDoseResponsePoints
                }
              />
            </div>
          )}
        {selectedContextNameInfo.name !== "All" && !isLoading && data && (
          <div>
            <div className={styles.plotFrame}>
              {selectedPlotLabels && selectedPlotLabels.size > 0 ? (
                <div className={styles.boxPlotHeader}>
                  {boxplotError && !isLoadingBoxplot && (
                    <div className={styles.initialLoadError}>
                      <h1>Sorry, an error occurred</h1>
                      <p>There was an error loading this plot.</p>
                    </div>
                  )}
                  {!boxplotError && isLoadingBoxplot && <PlotSpinner />}
                  {!boxplotError &&
                    boxPlotData &&
                    selectedContextNode &&
                    boxPlotMaxFDR &&
                    boxPlotMinEffectSize &&
                    boxPlotMinFracDepIn && (
                      <CollapsibleBoxPlots
                        handleSetMainPlotElement={(
                          element: ExtendedPlotType | null
                        ) => {
                          if (element) {
                            /* do nothing */
                          }
                        }}
                        topContextNameInfo={topContextNameInfo}
                        selectedCode={selectedContextNameInfo.subtype_code}
                        boxPlotData={boxPlotData}
                        entityType={entityType}
                        datasetId={datasetId}
                      />
                    )}
                </div>
              ) : (
                <div className={styles.boxPlotHeader}>
                  <h2
                    style={{
                      marginBottom: "15px",
                    }}
                  >
                    {entityType === "gene" ? "Gene" : "Compound"} Detail
                  </h2>
                  <h4
                    style={{
                      textAlign: "left",
                      margin: "20 20 20 20",
                    }}
                  >
                    {entityType === "gene" && GENE_DETAIL_NO_GENE_SELECTED}
                    {entityType === "compound" &&
                      datasetId ===
                        ContextExplorerDatasets.Prism_oncology_AUC &&
                      ONCREF_DETAIL_NO_COMPOUND_SELECTED}
                    {entityType === "compound" &&
                      datasetId === ContextExplorerDatasets.Rep_all_single_pt &&
                      REPURPOSING_DETAIL_NO_COMPOUND_SELECTED}
                  </h4>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ContextAnalysis;
