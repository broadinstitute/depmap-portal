import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "src/contextExplorer/styles/ContextExplorer.scss";
import {
  ContextAnalysisPlotData,
  ContextAnalysisPlotType,
  ContextAnalysisTableType,
  ContextNameInfo,
  ContextPlotBoxData,
  OutGroupType,
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
  GENE_DATASET_ID,
  COMPOUND_DATASET_ID,
  getBoxPlotFilterVariables,
} from "../../utils";
import geneDepFilterDefinitions from "../../json/geneDepFilters.json";
import drugFilterDefinitions from "../../json/drugFilters.json";
import Select from "react-select";
import filterLayout from "../../json/filterLayout.json";
import { satisfiesFilters } from "src/common/models/discoveryAppFilters";
import ContextAnalysisTable from "./ContextAnalysisTable";
import FilterInputGroup from "src/common/components/FilterControls/FilterInputGroup";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { getDapi } from "src/common/utilities/context";
import { Button } from "react-bootstrap";
import useContextExplorerFilters from "src/contextExplorer/hooks/useContextExplorerFilters";
import EntityDetailBoxPlot from "./EntityDetailBoxPlot";

interface ContextAnalysisProps {
  selectedContextNameInfo: ContextNameInfo;
  topContextNameInfo: ContextNameInfo;
  entityType: string;
  customInfoImg: React.JSX.Element;
}

function ContextAnalysis({
  selectedContextNameInfo,
  topContextNameInfo,
  entityType,
  customInfoImg,
}: ContextAnalysisProps) {
  const dapi = getDapi();
  const [outgroup, setOutgroup] = useState<{
    value: OutGroupType;
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
    (selection: { value: OutGroupType; label: string }) => {
      setOutgroup(selection);
    },
    [setOutgroup]
  );

  useEffect(() => {
    const outGroupOpts: { value: string; label: string }[] = [];

    // All other cell lines
    outGroupOpts.push(OUTGROUP_TYPE_ALL_OPTION);

    // Other Bone
    if (topContextNameInfo.name !== selectedContextNameInfo.name) {
      // Bone vs Other Bone wouldn't make sense, so only include this if the selected
      // context is a subset of Bone
      outGroupOpts.push({
        value: OutGroupType.Lineage,
        label: `Other ${topContextNameInfo.display_name}`,
      });
    }

    // Other Solid
    if (
      BLOOD_LINEAGES.includes(topContextNameInfo.display_name) ||
      BLOOD_LINEAGES.includes(topContextNameInfo.name)
    ) {
      outGroupOpts.push({
        value: OutGroupType.Type,
        label: "Other Heme",
      });
    } else {
      outGroupOpts.push({
        value: OutGroupType.Type,
        label: "Other Solid",
      });
    }
    setOutgroupOptions(outGroupOpts);
  }, [topContextNameInfo, selectedContextNameInfo.name]);

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
        setOutgroup({ value: outgroup.value, label: newOutgroup[0].label });
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
    setIsLoading(true);
    if (didValidateOutgroup) {
      const promise = dapi.getContextExplorerAnalysisData(
        selectedContextNameInfo.name,
        outgroup.value,
        entityType
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
    outgroup,
    entityType,
    dapi,
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
  const [entityUrlRoot, setEntityUrlRoot] = useState<string | null>(null);

  // TODO: In the future, we should take stickyFiltersMode out since it's always turned off. The decision
  // to turn this off was made right before the 24q4 release, so it was decided that it's temporarily less risky to
  // turn off the stickyFiltersMode instead of completely removing the ability to set stickyFiltersMode.
  const stickyFiltersMode = false; // DO NOT CHANGE THIS TO TRUE.

  // useContextExplorerFilters is very similar to useDiscoveryAppFilters. They
  // are temporarily separated out into 2 different files while the stickyFiltersMode
  // and Context Explorer is new. This is to reduce the risk of breaking Context Explorer,
  // TDA, and Compound Dashboard all at once.
  const {
    transientFilterState,
    filters,
    updateFilter,
    changedFilters,
    defaultFilters,
  } = useContextExplorerFilters(
    data,
    entityType === "gene" ? geneDepFilterDefinitions : drugFilterDefinitions,
    stickyFiltersMode
  );

  const [pointVisibility, setPointVisibility] = useState<boolean[]>([]);

  useEffect(() => {
    setSelectedPlotLabels(null);
    setSelectedTableLabels(null);
    setPointVisibilityFiltered(null);
  }, [selectedContextNameInfo]);

  useEffect(() => {
    if (data && filters) {
      setPointVisibility(
        filters && data ? satisfiesFilters(filters, data) : []
      );
    }
  }, [data, filters]);

  const formatDataForScatterPlot = useCallback(
    (tableData: ContextAnalysisTableType) => {
      const entityLabels: string[] = [];
      const logOR: number[] = [];
      const tTestXVals: number[] = [];
      const tTestYVals: number[] = [];
      const inVsOutXVals: number[] = [];
      const inVsOutYVals: number[] = [];

      tableData.entity.forEach((entity, i) => {
        entityLabels.push(entity);
        logOR.push(tableData.log_OR[i]);
        tTestXVals.push(tableData.effect_size[i]);
        tTestYVals.push(tableData.t_qval_log[i]);
        inVsOutXVals.push(tableData.mean_in[i]);
        inVsOutYVals.push(tableData.mean_out[i]);
      });
      return {
        indexLabels: entityLabels,
        logOR,
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
                : "In-context mean log2(viability)",
            values: inVsOutXVals,
          },
          y: {
            axisLabel:
              entityType === "gene"
                ? "Out-group mean gene effect"
                : "Out-group mean log2(viability)",
            values: inVsOutYVals,
          },
        },
      };
    },
    [entityType]
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
      setSelectedTableLabels,
      setSelectedPlotLabels,
      setPointVisibilityFiltered,
    ]
  );

  const handleSetSelectedPlotLabels = useCallback(
    (labels: Set<string> | null) => {
      setSelectedPlotLabels(labels);
    },
    [setSelectedPlotLabels]
  );

  const continuousColorScale = useMemo(() => {
    const values = plotData?.logOR;
    if (!values) {
      return undefined;
    }
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];

      if (value !== null && value < min) {
        min = value;
      }

      if (value !== null && value > max) {
        max = value;
      }
    }

    const zeroPosition = Math.abs((0 - min) / (max - min));
    const scale = [
      ["0.0", "#0000FF"], // Blue to label Depletions (points with the most negative log(OR)
      [zeroPosition.toString(), "#DDDCDC"],
      ["1.0", "#FF0000"], // Red to label Enrichments (points with the most positive log(OR))
    ];

    return scale;
  }, [plotData]);

  const calcEnrichmentDepletionBins = useCallback((values: number[]) => {
    if (values.length === 0) {
      return null;
    }

    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];

      if (value !== null && value < min) {
        min = value;
      }

      if (value !== null && value > max) {
        max = value;
      }
    }

    const binNumber = 7;
    const legendMin = -2;
    const legendMax = 2;
    const legendRange = legendMax + Math.abs(legendMin);

    let binStart = legendMin;
    const legendBinSize = legendRange / binNumber;

    const bins = [];
    for (let i = 0; i < binNumber; i += 1) {
      const binEnd = i === binNumber - 1 ? legendMax : binStart + legendBinSize;
      bins.push([binStart, binEnd]);
      binStart = binEnd;
    }

    return {
      [LEGEND_RANGE_1]: bins[0],
      [LEGEND_RANGE_2]: bins[1],
      [LEGEND_RANGE_3]: bins[2],
      [LEGEND_RANGE_4]: bins[3],
      [LEGEND_RANGE_5]: bins[4],
      [LEGEND_RANGE_6]: bins[5],
      [LEGEND_RANGE_7]: bins[6],
    };
  }, []);

  const continuousBins = useMemo(
    () => (plotData ? calcEnrichmentDepletionBins(plotData.logOR) : null),
    [plotData, calcEnrichmentDepletionBins]
  );

  const colorMap = useMemo(() => {
    if (!plotData?.logOR || !continuousColorScale) {
      return {
        [LEGEND_ALL]: DEFAULT_PALETTE.all,
      };
    }

    if (plotData?.logOR.length === 0) {
      return {
        [LEGEND_ALL]: DEFAULT_PALETTE.all,
      };
    }

    let colorM: Partial<Record<LegendKey, string>> = {};

    colorM = {
      [LEGEND_RANGE_1]: continuousColorScale[0][1],
      [LEGEND_RANGE_2]: "#BCD0F5",
      [LEGEND_RANGE_3]: "#BCD0F5",
      [LEGEND_RANGE_4]: continuousColorScale[1][1],
      [LEGEND_RANGE_5]: "#EDC5AF",
      [LEGEND_RANGE_6]: "#EDC5AF",
      [LEGEND_RANGE_7]: continuousColorScale[2][1],
    };

    return colorM;
  }, [plotData?.logOR, continuousColorScale]);

  const getEntityUrlRoot = useCallback(
    () =>
      entityType === "gene" ? dapi.getGeneUrlRoot() : dapi.getCompoundUrlRoot(),
    [dapi, entityType]
  );

  useEffect(() => {
    getEntityUrlRoot().then((urlRoot: string) => {
      setEntityUrlRoot(urlRoot);
    });
  }, [getEntityUrlRoot]);

  const [boxPlotData, setBoxPlotData] = useState<ContextPlotBoxData | null>(
    null
  );
  const [
    entityDetailPlotElement,
    setEntityDetailPlotElement,
  ] = useState<ExtendedPlotType | null>(null);

  const [isLoadingBoxplot, setIsLoadingBoxplot] = useState<boolean>(true);
  const [
    useScatterPlotFiltersOnBoxPlot,
    setUseScatterPlotFiltersOnBoxPlot,
  ] = useState<boolean>(false);
  const [boxPlotFDRRange, setBoxPlotFDRRange] = useState<number[] | null>(null);
  const [boxPlotEffectSizeRange, setBoxPlotEffectSizeRange] = useState<
    number[] | null
  >(null);
  const [boxPlotFracDepInRange, setBoxPlotFracDepInRange] = useState<
    number[] | null
  >(null);

  useEffect(() => {
    if (
      filters &&
      selectedPlotLabels &&
      selectedPlotLabels.size > 0 &&
      [...selectedPlotLabels][0]
    ) {
      const boxPlotFilters =
        !useScatterPlotFiltersOnBoxPlot &&
        defaultFilters &&
        defaultFilters.current
          ? defaultFilters.current
          : filters;

      const { fdr, effectSize, fracDepIn } = getBoxPlotFilterVariables(
        boxPlotFilters
      );

      setBoxPlotFDRRange(fdr);
      setBoxPlotEffectSizeRange(effectSize);
      setBoxPlotFracDepInRange(fracDepIn);
    }
  }, [
    useScatterPlotFiltersOnBoxPlot,
    filters,
    selectedPlotLabels,
    defaultFilters,
  ]);

  const [boxplotError, setBoxplotError] = useState(false);
  const boxplotLatestPromise = useRef<Promise<ContextPlotBoxData> | null>(null);

  useEffect(() => {
    if (
      selectedPlotLabels &&
      selectedPlotLabels.size > 0 &&
      [...selectedPlotLabels][0] &&
      boxPlotFDRRange &&
      boxPlotEffectSizeRange &&
      boxPlotFracDepInRange
    ) {
      setBoxPlotData(null);
      setEntityDetailPlotElement(null);
      setIsLoadingBoxplot(true);
      const boxplotPromise = dapi.getContextExplorerBoxPlotData(
        selectedContextNameInfo.name,
        entityType === "gene" ? GENE_DATASET_ID : COMPOUND_DATASET_ID,
        topContextNameInfo.name,
        outgroup.value,
        entityType,
        [...selectedPlotLabels][0],
        boxPlotFDRRange,
        boxPlotEffectSizeRange,
        boxPlotFracDepInRange
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
    selectedPlotLabels,
    entityType,
    dapi,
    topContextNameInfo,
    boxPlotFDRRange,
    boxPlotEffectSizeRange,
    boxPlotFracDepInRange,
  ]);

  const handleUseScatterPlotFiltersClicked = () => {
    setUseScatterPlotFiltersOnBoxPlot(!useScatterPlotFiltersOnBoxPlot);
  };

  const [showOtherContexts, setShowOtherContexts] = useState<boolean>(false);

  const handleShowOtherContexts = useCallback(() => {
    setShowOtherContexts(!showOtherContexts);
  }, [showOtherContexts]);

  return (
    <div className={styles.geneDepPage}>
      <section className={styles.plotContainer}>
        <div className={styles.overviewGraphHeader}>
          {selectedContextNameInfo.name !== "All" && data && (
            <>
              <h2>
                Dependencies enriched/depleted in{" "}
                {selectedContextNameInfo.display_name}
              </h2>
              <h4>
                Displayed here are{" "}
                {entityType === "gene"
                  ? "gene dependencies"
                  : "drug sensitivities"}{" "}
                that occur more strongly or more frequently in{" "}
                {selectedContextNameInfo.display_name} cell lines compared to{" "}
                {outgroup.label.toLowerCase()} cell lines.
              </h4>
            </>
          )}{" "}
          {error && (
            <div className={styles.initialLoadError}>
              <h1>Sorry, an error occurred</h1>
              <p>There was an error loading these plots.</p>
            </div>
          )}
          {!error && selectedContextNameInfo.name === "All" ? (
            <h1 style={{ textAlign: "center", color: "#808080" }}>
              Select A More Specific Context
            </h1>
          ) : (
            !error &&
            !isLoading &&
            !data && <h2>Not enough data points. Choose a larger context.</h2>
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
                      }
                    }}
                    id="context-explorer-outgroup-selection"
                  />
                </div>
              </div>
            )}
            {continuousBins && selectedContextNameInfo.name !== "All" && (
              <ScatterPlotLegend
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
                        ? plotData.logOR.map(() => true)
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
                        ? plotData.logOR.map(() => true)
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
                    topContextNameInfo.name,
                    selectedContextNameInfo.name,
                    outgroup.value,
                    entityType
                  )}
                  target="_blank"
                  disabled={
                    selectedContextNameInfo.name === "All" ||
                    (!isLoading && !data)
                  }
                >
                  Open This Plot in Data Explorer 2
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
              <h3>Data Table and Filters</h3>
              {entityType === "gene" ? (
                <p style={{ fontSize: "14px", paddingRight: "35px" }}>
                  Use the filters in order to adjust the data shown in the plots
                  above and the table below. To see stronger results, restrict
                  the range of FDR adjusted T-test p-values, the range of
                  absolute value of the effect size, and the percentage of
                  in-context lines that are dependent on the gene. Including
                  genes with positive effect sizes will display genes that are
                  weaker dependencies in the selected context as compared to the
                  out-group.
                </p>
              ) : (
                <p style={{ fontSize: "14px", paddingRight: "35px" }}>
                  Use the filters in order to adjust the data shown in the plots
                  above and the table below. To see stronger results, restrict
                  the range of FDR adjusted T-test p-values, the range of
                  absolute value of the effect size, and the percentage of
                  in-context lines that are sensitive to the drug. Including
                  drugs with positive effect sizes will display drugs that are
                  weaker sensitivities in the selected context as compared to
                  the out-group.
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
                  group={filterLayout[0].groups[0]}
                  filters={transientFilterState}
                  onChangeFilter={updateFilter}
                  hasChanges={filterLayout[0].groups[0].keys.some(
                    (key: any) => changedFilters.indexOf(key) > -1
                  )}
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
                entityUrlRoot={entityUrlRoot}
                entityType={entityType}
              />
            </div>
          )}
        </div>
      </section>
      {selectedContextNameInfo.name !== "All" && !isLoading && data && (
        <div className={styles.right}>
          {selectedPlotLabels && selectedPlotLabels.size > 0 ? (
            <div className={styles.boxPlotHeader}>
              <h2 style={{ marginBottom: "0" }}>
                {entityType === "gene" ? "Gene" : "Drug"} Detail
                {selectedPlotLabels && <span> - {selectedPlotLabels}</span>}
              </h2>
              {boxPlotData && (
                <a
                  href={`${entityUrlRoot}${boxPlotData.entity_label}`}
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
              {boxplotError && (
                <div className={styles.initialLoadError}>
                  <h1>Sorry, an error occurred</h1>
                  <p>There was an error loading this plot.</p>
                </div>
              )}
              {!boxplotError &&
                (!entityDetailPlotElement || isLoadingBoxplot) && (
                  <PlotSpinner />
                )}
              {!boxplotError && boxPlotData && (
                <EntityDetailBoxPlot
                  handleSetPlotElement={(element: ExtendedPlotType | null) => {
                    if (element) {
                      setEntityDetailPlotElement(element);
                    }
                  }}
                  selectedContextNameInfo={selectedContextNameInfo}
                  topContextNameInfo={topContextNameInfo}
                  boxPlotData={boxPlotData}
                  entityType={entityType}
                  mainPlot={entityDetailPlotElement}
                  useScatterPlotFiltersOnBoxPlot={
                    useScatterPlotFiltersOnBoxPlot
                  }
                  handleUseScatterPlotFiltersClicked={
                    handleUseScatterPlotFiltersClicked
                  }
                  boxPlotFDRRange={boxPlotFDRRange}
                  boxPlotEffectSizeRange={boxPlotEffectSizeRange}
                  boxPlotFracDepInRange={boxPlotFracDepInRange}
                  showOtherContexts={showOtherContexts}
                  handleShowOtherContexts={handleShowOtherContexts}
                  customInfoImg={customInfoImg}
                />
              )}
            </div>
          ) : (
            <div className={styles.boxPlotHeader}>
              <h2 style={{ marginBottom: "15px" }}>
                {entityType === "gene" ? "Gene" : "Drug"} Detail
              </h2>
              <h4
                style={{
                  textAlign: "left",
                  margin: "20 20 20 20",
                }}
              >
                Select a {entityType === "gene" ? "gene" : "drug"} to see the
                distribution of{" "}
                {entityType === "gene" ? "gene effects" : "log2(viability)"} in
                the selected context and other groups.
              </h4>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ContextAnalysis;
