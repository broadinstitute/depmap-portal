import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDataExplorerSettings } from "../../../../contexts/DataExplorerSettingsContext";
import { enabledFeatures } from "@depmap/globals";
import SpinnerOverlay from "./SpinnerOverlay";
import type ExtendedPlotType from "../../ExtendedPlotType";
import {
  DataExplorerContext,
  DataExplorerPlotConfig,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotResponse,
} from "@depmap/types";
import { isBreadboxOnlyMode } from "../../../../isBreadboxOnlyMode";
import {
  LegendKey,
  calcBins,
  calcDensityStats,
  calcVisibility,
  categoryToDisplayName,
  formatDataForScatterPlot,
  getColorMap,
  useLegendState,
} from "./prototype/plotUtils";
import PrototypeDensity1D from "./prototype/PrototypeDensity1D";
import DataExplorerPlotControls from "./DataExplorerPlotControls";
import SectionStack, { StackableSection } from "../SectionStack";
import PlotLegend from "./PlotLegend";
import PlotSelections from "./PlotSelections";
import GeneTea from "./integrations/GeneTea";
import promptForSelectionFromContext from "./promptForSelectionFromContext";
import styles from "../../styles/DataExplorer2.scss";

interface Props {
  data: DataExplorerPlotResponse | null;
  isLoading: boolean;
  plotConfig: DataExplorerPlotConfig;
  onClickVisualizeSelected: (
    e: React.MouseEvent,
    selectedLabels: Set<string>
  ) => void;
  onClickSaveSelectionAsContext: (
    context_type: string,
    selectedLabels: Set<string>
  ) => void;
  onClickColorByContext: (context: DataExplorerContext) => void;
}

function DataExplorerDensity1DPlot({
  data,
  isLoading,
  plotConfig,
  onClickVisualizeSelected,
  onClickSaveSelectionAsContext,
  onClickColorByContext,
}: Props) {
  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<Set<string> | null>(
    null
  );
  const [showSpinner, setShowSpinner] = useState(isLoading);
  const { plotStyles } = useDataExplorerSettings();
  const {
    pointSize,
    pointOpacity,
    outlineWidth,
    palette,
    xAxisFontSize,
    yAxisFontSize,
  } = plotStyles;

  useEffect(() => {
    let timeout: number | undefined;

    if (!isLoading) {
      setShowSpinner(false);
    } else {
      timeout = window.setTimeout(() => setShowSpinner(true), 0);
    }

    return () => clearTimeout(timeout);
  }, [isLoading]);

  const { slice_type } = plotConfig.dimensions
    .x as DataExplorerPlotConfigDimension;

  useEffect(() => {
    setSelectedLabels(null);
  }, [slice_type]);

  useEffect(() => {
    if (!data?.index_labels) {
      return;
    }

    const validSelections = new Set(data.index_labels || []);

    setSelectedLabels((xs) => {
      if (!xs) {
        return null;
      }

      const ys = new Set<string>();
      const labels = [...xs];

      for (let i = 0; i < labels.length; i += 1) {
        const label = labels[i];
        if (validSelections.has(label)) {
          ys.add(label);
        }
      }

      return ys;
    });
  }, [data]);

  const selectedPoints = useMemo(() => {
    const out: Set<number> = new Set();

    if (!data?.index_labels) {
      return out;
    }

    for (let i = 0; i < data.index_labels.length; i += 1) {
      if (selectedLabels?.has(data.index_labels[i])) {
        out.add(i);
      }
    }

    return out;
  }, [data, selectedLabels]);

  const handleMultiselect = useCallback(
    (pointIndices: number[]) => {
      if (pointIndices.length > 0) {
        const s = new Set<string>();
        pointIndices.forEach((i: number) => {
          s.add(data!.index_labels[i]);
        });
        setSelectedLabels(s);
      }
    },
    [data]
  );

  const handleClickPoint = useCallback(
    (pointIndex: number, ctrlKey: boolean) => {
      const label = data!.index_labels[pointIndex];

      if (ctrlKey) {
        setSelectedLabels((xs) => {
          const ys = new Set(xs);

          if (xs?.has(label)) {
            ys.delete(label);
          } else {
            ys.add(label);
          }

          return ys;
        });
      } else {
        setSelectedLabels(new Set([label]));
      }
    },
    [data, setSelectedLabels]
  );

  const formattedData: any = useMemo(
    () => formatDataForScatterPlot(data, plotConfig.color_by),
    [data, plotConfig.color_by]
  );

  const continuousBins = useMemo(
    () =>
      formattedData?.contColorData
        ? calcBins(formattedData.contColorData)
        : null,
    [formattedData]
  );

  const { sort_by } = plotConfig;

  const [colorData, legendKeysWithNoData, sortedLegendKeys] = useMemo(
    () => calcDensityStats(data, continuousBins, sort_by),
    [data, continuousBins, sort_by]
  );

  const {
    hiddenLegendValues,
    onClickLegendItem,
    handleClickShowAll,
    handleClickHideAll,
  } = useLegendState(plotConfig, legendKeysWithNoData);

  const colorMap = useMemo(
    () => getColorMap(data, plotConfig, palette, sortedLegendKeys),
    [data, plotConfig, palette, sortedLegendKeys]
  );

  const legendDisplayNames = useMemo(() => {
    const out: any = {};

    if (!data) {
      return out;
    }

    (Reflect.ownKeys(colorMap || {}) as LegendKey[]).forEach((key) => {
      const name = categoryToDisplayName(key, data, continuousBins);
      out[key] = typeof name === "string" ? name : `${name[0]} – ${name[1]}`;
    });

    return out;
  }, [colorMap, data, continuousBins]);

  let legendTitle = "";

  if (data?.dimensions?.color) {
    legendTitle = `${data.dimensions.color.axis_label}<br>${data.dimensions.color.dataset_label}`;
  }

  if (data?.metadata?.color_property) {
    legendTitle = data.metadata.color_property.label;
  }

  const pointVisibility = useMemo(
    () =>
      calcVisibility(
        data,
        hiddenLegendValues,
        continuousBins,
        plotConfig.hide_points
      ),
    [data, hiddenLegendValues, continuousBins, plotConfig.hide_points]
  );

  return (
    <div className={styles.DataExplorerDensity1DPlot}>
      <div className={styles.left}>
        <div className={styles.plotControls}>
          <DataExplorerPlotControls
            data={data}
            isLoading={showSpinner}
            plotConfig={plotConfig}
            plotElement={plotElement}
            handleClickPoint={handleClickPoint}
            onClickUnselectAll={() => {
              setSelectedLabels(null);
            }}
          />
        </div>
        <div className={styles.plot}>
          {showSpinner && <SpinnerOverlay />}
          {formattedData && (
            <PrototypeDensity1D
              data={formattedData}
              xKey="x"
              colorMap={colorMap}
              colorData={colorData}
              continuousColorKey="contColorData"
              legendDisplayNames={legendDisplayNames}
              legendTitle={legendTitle}
              pointVisibility={pointVisibility || undefined}
              useSemiOpaqueViolins={!plotConfig.hide_points}
              hoverTextKey="hoverText"
              annotationTextKey="annotationText"
              height="auto"
              onLoad={setPlotElement}
              onClickPoint={handleClickPoint}
              onMultiselect={handleMultiselect}
              selectedPoints={selectedPoints}
              onClickResetSelection={() => {
                setSelectedLabels(null);
              }}
              hiddenLegendValues={hiddenLegendValues}
              pointSize={pointSize}
              pointOpacity={pointOpacity}
              outlineWidth={outlineWidth}
              palette={palette}
              xAxisFontSize={xAxisFontSize}
              yAxisFontSize={yAxisFontSize}
            />
          )}
        </div>
      </div>
      <div className={styles.right}>
        <SectionStack>
          <StackableSection title="Legend" minHeight={120}>
            <PlotLegend
              data={data}
              colorMap={colorMap}
              continuousBins={continuousBins}
              hiddenLegendValues={hiddenLegendValues}
              legendKeysWithNoData={legendKeysWithNoData}
              onClickLegendItem={onClickLegendItem}
              handleClickShowAll={handleClickShowAll}
              handleClickHideAll={handleClickHideAll}
            />
          </StackableSection>
          <StackableSection title="Plot Selections" minHeight={256}>
            <PlotSelections
              data={data}
              plot_type={plotConfig?.plot_type || null}
              selectedLabels={selectedLabels}
              onClickVisualizeSelected={(e) =>
                onClickVisualizeSelected(e, selectedLabels as Set<string>)
              }
              onClickSaveSelectionAsContext={() => {
                onClickSaveSelectionAsContext(
                  plotConfig.index_type,
                  selectedLabels as Set<string>
                );
              }}
              onClickClearSelection={() => {
                setSelectedLabels(null);
              }}
              onClickSetSelectionFromContext={
                // FIXME
                isBreadboxOnlyMode
                  ? () => {
                      window.alert("Not currently supported with Breadbox!");
                    }
                  : async () => {
                      const labels = await promptForSelectionFromContext(data!);

                      if (labels === null) {
                        return;
                      }

                      setSelectedLabels(labels);
                      plotElement?.annotateSelected();
                    }
              }
            />
          </StackableSection>
          {enabledFeatures.gene_tea && plotConfig.index_type === "gene" ? (
            <StackableSection
              title="GeneTEA Enriched Terms"
              minHeight={200}
              defaultOpen={false}
            >
              <GeneTea
                selectedLabels={selectedLabels}
                onClickColorByContext={onClickColorByContext}
              />
            </StackableSection>
          ) : null}
        </SectionStack>
      </div>
    </div>
  );
}

export default DataExplorerDensity1DPlot;
