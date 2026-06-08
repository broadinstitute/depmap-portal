import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDataExplorerSettings } from "../../../../contexts/DataExplorerSettingsContext";
import { isPortal } from "@depmap/globals";
import SpinnerOverlay from "./SpinnerOverlay";
import type ExtendedPlotType from "../../ExtendedPlotType";
import {
  DataExplorerContextV2,
  DataExplorerPlotConfig,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotResponse,
} from "@depmap/types";
import useDensity1DPlotData from "./prototype/useDensity1DPlotData";
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
    selectedIds: Set<string>
  ) => void;
  onClickSaveSelectionAsContext: (
    dimension_type: string,
    selectedIds: Set<string>
  ) => void;
  onClickColorByContext: (context: DataExplorerContextV2) => void;
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
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(
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

  const {
    formattedData,
    continuousBins,
    colorData,
    legendKeysWithNoData,
    legendState,
    colorMap,
    legendDisplayNames,
    legendTitle,
    pointVisibility,
  } = useDensity1DPlotData(data, plotConfig, palette);

  const {
    hiddenLegendValues,
    onClickLegendItem,
    handleClickShowAll,
    handleClickHideAll,
  } = legendState;

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
    setSelectedIds(null);
  }, [slice_type]);

  useEffect(() => {
    if (!data?.index_ids) {
      return;
    }

    const validSelections = new Set(data.index_ids || []);

    setSelectedIds((xs) => {
      if (!xs) {
        return null;
      }

      const ys = new Set<string>();
      const ids = [...xs];

      for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i];
        if (validSelections.has(id)) {
          ys.add(id);
        }
      }

      return ys;
    });
  }, [data]);

  const selectedPoints = useMemo(() => {
    const out: Set<number> = new Set();

    if (!data?.index_ids) {
      return out;
    }

    for (let i = 0; i < data.index_ids.length; i += 1) {
      if (selectedIds?.has(data.index_ids[i])) {
        out.add(i);
      }
    }

    return out;
  }, [data, selectedIds]);

  const handleMultiselect = useCallback(
    (pointIndices: number[]) => {
      if (pointIndices.length > 0) {
        const s = new Set<string>();
        pointIndices.forEach((i: number) => {
          s.add(data!.index_ids[i]);
        });
        setSelectedIds(s);
      }
    },
    [data]
  );

  const handleClickPoint = useCallback(
    (pointIndex: number, ctrlKey: boolean) => {
      const id = data!.index_ids[pointIndex];

      if (ctrlKey) {
        setSelectedIds((xs) => {
          const ys = new Set(xs);

          if (xs?.has(id)) {
            ys.delete(id);
          } else {
            ys.add(id);
          }

          return ys;
        });
      } else {
        setSelectedIds(new Set([id]));
      }
    },
    [data, setSelectedIds]
  );

  // GeneTea consumes display labels (gene symbols), not IDs. Convert at
  // the boundary by indexing the data's parallel id/label arrays.
  const selectedLabels = useMemo(() => {
    if (!data?.index_ids || !selectedIds) {
      return selectedIds;
    }

    const idToLabel: Record<string, string> = {};
    for (let i = 0; i < data.index_ids.length; i += 1) {
      idToLabel[data.index_ids[i]] = data.index_labels[i];
    }

    const out = new Set<string>();
    selectedIds.forEach((id) => {
      const label = idToLabel[id];
      if (label !== undefined) {
        out.add(label);
      }
    });
    return out;
  }, [data, selectedIds]);

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
              setSelectedIds(null);
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
                setSelectedIds(null);
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
              selectedIds={selectedIds}
              onClickVisualizeSelected={(e) =>
                onClickVisualizeSelected(e, selectedIds as Set<string>)
              }
              onClickSaveSelectionAsContext={() => {
                onClickSaveSelectionAsContext(
                  plotConfig.index_type,
                  selectedIds as Set<string>
                );
              }}
              onClickClearSelection={() => {
                setSelectedIds(null);
              }}
              onClickSetSelectionFromContext={async () => {
                const newSelectedIds = await promptForSelectionFromContext(data!);

                if (newSelectedIds === null) {
                  return;
                }

                setSelectedIds(newSelectedIds);
                plotElement?.annotateSelected();
              }}
            />
          </StackableSection>
          {isPortal && plotConfig.index_type === "gene" ? (
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
