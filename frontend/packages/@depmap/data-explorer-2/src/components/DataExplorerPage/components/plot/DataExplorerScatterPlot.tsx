import React, { useCallback, useEffect, useMemo, useState } from "react";
import { isPortal } from "@depmap/globals";
import {
  DataExplorerContextV2,
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
  LinRegInfo,
} from "@depmap/types";
import { useDataExplorerSettings } from "../../../../contexts/DataExplorerSettingsContext";
import type ExtendedPlotType from "../../ExtendedPlotType";
import SpinnerOverlay from "./SpinnerOverlay";
import useScatterPlotData from "./prototype/useScatterPlotData";
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
  linreg_by_group: LinRegInfo[] | null;
  onClickColorByContext: (context: DataExplorerContextV2) => void;
  onClickSaveSelectionAsContext: (
    dimension_type: string,
    selectedIds: Set<string>
  ) => void;
  onClickVisualizeSelected: (
    e: React.MouseEvent,
    selectedIds: Set<string>
  ) => void;
  plotConfig: DataExplorerPlotConfig;
}

function DataExplorerScatterPlot({
  data,
  isLoading,
  linreg_by_group,
  onClickColorByContext,
  onClickSaveSelectionAsContext,
  onClickVisualizeSelected,
  plotConfig,
}: Props) {
  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);
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
    contLegendKeys,
    legendKeysWithNoData,
    legendState,
    colorMap,
    legendForDownload,
    pointVisibility,
    regressionLines,
    showIdentityLine,
  } = useScatterPlotData(data, plotConfig, linreg_by_group, palette);

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

  const slice_type0 = plotConfig.dimensions.x?.slice_type;
  const slice_type1 = plotConfig.dimensions.y?.slice_type;

  useEffect(() => {
    setSelectedIds(null);
  }, [slice_type0, slice_type1]);

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
      if (data && pointIndices.length > 0) {
        const s = new Set<string>();
        pointIndices.forEach((i: number) => {
          s.add(data.index_ids[i]);
        });
        setSelectedIds(s);
      }
    },
    [data]
  );

  const handleClickPoint = useCallback(
    (pointIndex: number, ctrlKey: boolean) => {
      if (!data) {
        return;
      }

      const id = data.index_ids[pointIndex];

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
    <div className={styles.DataExplorerScatterPlot}>
      <div className={styles.left}>
        <div className={styles.plotControls}>
          <DataExplorerPlotControls
            data={data}
            plotConfig={plotConfig}
            isLoading={showSpinner}
            plotElement={plotElement}
            handleClickPoint={handleClickPoint}
            onClickUnselectAll={() => setSelectedIds(null)}
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
              showIdentityLine={showIdentityLine}
              regressionLines={regressionLines}
              onClickResetSelection={() => setSelectedIds(null)}
              legendForDownload={legendForDownload}
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
          <StackableSection title="Legend" minHeight={132}>
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
                const newSelectedIds = await promptForSelectionFromContext(
                  data!
                );

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

export default DataExplorerScatterPlot;
