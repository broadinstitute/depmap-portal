import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDataExplorerSettings } from "../../../../contexts/DataExplorerSettingsContext";
import { enabledFeatures } from "@depmap/globals";
import SpinnerOverlay from "./SpinnerOverlay";
import type ExtendedPlotType from "../../ExtendedPlotType";
import {
  DataExplorerContext,
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
} from "@depmap/types";
import {
  LegendKey,
  calcBins,
  calcVisibility,
  categoryToDisplayName,
  continuousValuesToLegendKeySeries,
  findCategoricalSlice,
  formatDataForWaterfall,
  getColorMap,
  getLegendKeysWithNoData,
  sortLegendKeysWaterfall,
  useLegendState,
} from "./prototype/plotUtils";
import PrototypeScatterPlot from "./prototype/PrototypeScatterPlot";
import DataExplorerPlotControls from "./DataExplorerPlotControls";
import PlotLegend from "./PlotLegend";
import PlotSelections from "./PlotSelections";
import GeneTea from "./integrations/GeneTea";
import SectionStack, { StackableSection } from "../SectionStack";
import promptForSelectionFromContext from "./promptForSelectionFromContext";
import styles from "../../styles/DataExplorer2.scss";

interface Props {
  data: DataExplorerPlotResponse | null;
  isLoading: boolean;
  plotConfig: DataExplorerPlotConfig;
  onClickColorByContext: (context: DataExplorerContext) => void;
  onClickSaveSelectionAsContext: (
    context_type: string,
    selectedLabels: Set<string>
  ) => void;
  onClickVisualizeSelected: (
    e: React.MouseEvent,
    selectedLabels: Set<string>
  ) => void;
}

function DataExplorerWaterfallPlot({
  data,
  isLoading,
  plotConfig,
  onClickColorByContext,
  onClickSaveSelectionAsContext,
  onClickVisualizeSelected,
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

  const slice_type0 = plotConfig.dimensions.x?.slice_type;
  const slice_type1 = plotConfig.dimensions.y?.slice_type;

  useEffect(() => {
    setSelectedLabels(null);
  }, [slice_type0, slice_type1]);

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
      if (data && pointIndices.length > 0) {
        const s = new Set<string>();
        pointIndices.forEach((i: number) => {
          s.add(data.index_labels[i]);
        });
        setSelectedLabels(s);
      }
    },
    [data]
  );

  const handleClickPoint = useCallback(
    (pointIndex: number, ctrlKey: boolean) => {
      if (!data) {
        return;
      }

      const label = data.index_labels[pointIndex];

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

  const sortedLegendKeys = useMemo(() => {
    const catData = findCategoricalSlice(data);

    if (!catData || !data?.dimensions?.y) {
      return undefined;
    }

    return sortLegendKeysWaterfall(data, catData, plotConfig.sort_by) as
      | LegendKey[]
      | undefined;
  }, [data, plotConfig.sort_by]);

  const formattedData: {
    annotationText: string[];
    catColorData: (string | number | null)[] | null;
    color1: (boolean | null)[] | null;
    color2: (boolean | null)[] | null;
    contColorData: (number | null)[] | null;
    hoverText: string[];
    x: (number | null)[] | null;
    y: (number | null)[] | null;
    xLabel: string | null;
    yLabel: string | null;
  } | null = useMemo(
    () => formatDataForWaterfall(data, plotConfig.color_by, sortedLegendKeys),
    [data, plotConfig, sortedLegendKeys]
  );

  const continuousBins = useMemo(
    () =>
      formattedData?.contColorData
        ? calcBins(formattedData.contColorData)
        : null,
    [formattedData]
  );

  const [contLegendKeys] = useMemo(
    () =>
      formattedData?.contColorData
        ? continuousValuesToLegendKeySeries(
            formattedData.contColorData,
            continuousBins
          )
        : [null],
    [continuousBins, formattedData]
  );

  const legendKeysWithNoData = useMemo(() => {
    return getLegendKeysWithNoData(data, continuousBins);
  }, [data, continuousBins]);

  const {
    hiddenLegendValues,
    onClickLegendItem,
    handleClickShowAll,
    handleClickHideAll,
  } = useLegendState(plotConfig, legendKeysWithNoData);

  const colorMap = useMemo(() => {
    return getColorMap(data, plotConfig, palette, sortedLegendKeys);
  }, [data, plotConfig, palette, sortedLegendKeys]);

  // The plot only needs legend info if the user is downloading an image of it.
  const legendForDownload = useMemo(() => {
    let title = "";

    if (data?.dimensions?.color) {
      title = `${data.dimensions.color.axis_label}<br>${data.dimensions.color.dataset_label}`;
    }

    if (data?.metadata?.color_property) {
      title = data.metadata.color_property.label;
    }

    const items: { name: string; hexColor: string }[] = [];

    [...colorMap.keys()].forEach((key) => {
      if (!hiddenLegendValues.has(key)) {
        const name = categoryToDisplayName(
          key,
          data as DataExplorerPlotResponse,
          continuousBins
        );
        const formattedName =
          typeof name === "string" ? name : `${name[0]} – ${name[1]}`;

        items.push({
          name: formattedName,
          hexColor: colorMap.get(key)!,
        });
      }
    });

    return {
      title,
      items,
    };
  }, [colorMap, data, continuousBins, hiddenLegendValues]);

  const pointVisibility = useMemo(
    () => calcVisibility(data, hiddenLegendValues, continuousBins),
    [data, hiddenLegendValues, continuousBins]
  );

  return (
    <div className={styles.DataExplorerScatterPlot}>
      <div className={styles.left}>
        <div className={styles.plotControls}>
          <DataExplorerPlotControls
            data={data}
            plotConfig={plotConfig}
            isLoading={showSpinner}
            plotElement={plotElement}
            handleClickPoint={handleClickPoint}
            onClickUnselectAll={() => setSelectedLabels(null)}
          />
        </div>
        <div className={styles.plot}>
          {showSpinner && <SpinnerOverlay />}
          {formattedData && (
            <PrototypeScatterPlot
              data={formattedData}
              xKey="x"
              yKey="y"
              pointVisibility={pointVisibility || undefined}
              colorKey1="color1"
              colorKey2="color2"
              categoricalColorKey="catColorData"
              continuousColorKey="contColorData"
              contLegendKeys={contLegendKeys}
              colorMap={colorMap}
              hoverTextKey="hoverText"
              annotationTextKey="annotationText"
              height="auto"
              xLabel={formattedData?.xLabel || ""}
              yLabel={formattedData?.yLabel || ""}
              onLoad={setPlotElement}
              onClickPoint={handleClickPoint}
              onMultiselect={handleMultiselect}
              selectedPoints={selectedPoints}
              showIdentityLine={false}
              onClickResetSelection={() => setSelectedLabels(null)}
              legendForDownload={legendForDownload}
              pointSize={pointSize}
              pointOpacity={pointOpacity}
              outlineWidth={outlineWidth}
              customHoverinfo="y+text"
              hideXAxisGrid
              hideXAxis={Boolean(data?.metadata?.color_property)}
              palette={palette}
              xAxisFontSize={xAxisFontSize}
              yAxisFontSize={yAxisFontSize}
            />
          )}
        </div>
      </div>
      <div className={styles.right}>
        <SectionStack>
          <StackableSection title="Legend" minHeight={132}>
            <PlotLegend
              data={data}
              colorMap={colorMap}
              sortedLegendKeys={sortedLegendKeys}
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
              onClickSetSelectionFromContext={async () => {
                const labels = await promptForSelectionFromContext(data!);

                if (labels === null) {
                  return;
                }

                setSelectedLabels(labels);
                plotElement?.annotateSelected();
              }}
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

export default DataExplorerWaterfallPlot;
