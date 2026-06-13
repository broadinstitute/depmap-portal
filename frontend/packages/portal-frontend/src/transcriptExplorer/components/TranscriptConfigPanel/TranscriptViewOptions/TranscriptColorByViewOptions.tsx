import React from "react";
import {
  ContextSelectorV2,
  useDataExplorerSettings,
} from "@depmap/data-explorer-2";
import { ContextPath, DataExplorerContextV2, FilterKey } from "@depmap/types";
import DimensionSliceSelect from "@depmap/data-explorer-2/src/components/DimensionSelectV2/DimensionSliceSelect";
import { PlotConfigReducerAction } from "@depmap/data-explorer-2/src/components/DataExplorerPage/reducers/plotConfigReducer";
import { ColorByDimensionSelect } from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/ConfigurationPanel/selectors";
import ColorByAnnotationSelect from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/ConfigurationPanel/ColorByAnnotationSelect";
import TranscriptColorByTypeSelect from "./TranscriptColorByTypeSelect";
import styles from "../../../styles/TranscriptPlotConfig.scss";

interface Props {
  show: boolean;
  plot: any;
  dispatch: (action: PlotConfigReducerAction) => void;
  onClickCreateContext: (pathToCreate: ContextPath) => void;
  onClickSaveAsContext: (
    contextToEdit: DataExplorerContextV2,
    pathToSave: ContextPath
  ) => void;
}

function TranscriptColorByViewOptions({
  show,
  plot,
  dispatch,
  onClickCreateContext,
  onClickSaveAsContext,
}: Props) {
  const { plotStyles } = useDataExplorerSettings();
  const { palette } = plotStyles;

  if (!show) {
    return null;
  }

  const {
    index_type,
    plot_type,
    color_by,
    sort_by,
    dimensions,
    filters,
    metadata,
  } = plot;

  const dataset_id =
    dimensions?.x?.dataset_id || dimensions?.y?.dataset_id || null;

  return (
    <div className={styles.TranscriptColorByViewOptions}>
      <TranscriptColorByTypeSelect
        enable={Boolean(index_type)}
        value={color_by || null}
        index_type={index_type as string}
        onChange={(nextColorBy) =>
          dispatch({
            type: "select_color_by",
            payload: nextColorBy,
          })
        }
      />
      <div className={styles.colorByContext}>
        {(["color1", "color2"] as FilterKey[]).map((filterKey) => (
          <React.Fragment key={filterKey}>
            <DimensionSliceSelect
              show={color_by === "raw_slice"}
              units={null}
              isUnknownDataset={false}
              isLoading={false}
              dataType={null}
              dataset_id={dataset_id}
              index_type={null}
              slice_type={index_type as string}
              value={filters?.[filterKey]}
              onChange={(filter) => {
                dispatch({
                  type: "select_filter",
                  payload: {
                    key: filterKey,
                    filter: (filter as unknown) as DataExplorerContextV2,
                  },
                });
              }}
              swatchColor={
                filterKey === "color1" ? palette.compare1 : palette.compare2
              }
            />
            <ContextSelectorV2
              show={color_by === "aggregated_slice"}
              enable={color_by === "aggregated_slice"}
              value={filters?.[filterKey]}
              dimension_type={index_type}
              swatchColor={
                filterKey === "color1" ? palette.compare1 : palette.compare2
              }
              onClickCreateContext={() => {
                onClickCreateContext(["filters", filterKey]);
              }}
              onClickSaveAsContext={() =>
                onClickSaveAsContext(filters[filterKey], ["filters", filterKey])
              }
              onChange={(filter) => {
                dispatch({
                  type: "select_filter",
                  payload: { key: filterKey, filter },
                });
              }}
            />
          </React.Fragment>
        ))}
      </div>
      <ColorByAnnotationSelect
        show={color_by === "property"}
        dimension_type={index_type as string}
        value={metadata?.color_property}
        onChange={(sliceQuery) => {
          dispatch({
            type: "select_color_property",
            payload: sliceQuery,
          });
        }}
        onConvertToColorContext={(context) => {
          dispatch({
            type: "batch",
            payload: [
              { type: "select_color_by", payload: "aggregated_slice" },
              {
                type: "select_filter",
                payload: {
                  key: "color1" as FilterKey,
                  filter: (context as unknown) as DataExplorerContextV2,
                },
              },
            ],
          });
        }}
      />
      {color_by === "custom" && (
        <ColorByDimensionSelect
          plot_type={plot_type}
          index_type={plot.index_type || null}
          value={dimensions.color || null}
          onChange={(dimension) => {
            dispatch({
              type: "select_dimension",
              payload: { key: "color", dimension },
            });
          }}
          onClickCreateContext={() => {
            const path: ContextPath = ["dimensions", "color", "context"];
            onClickCreateContext(path);
          }}
          onClickSaveAsContext={() => {
            const path: ContextPath = ["dimensions", "color", "context"];
            const context = plot.dimensions.color.context;
            onClickSaveAsContext(context, path);
          }}
          // FIXME: A secondary SortBySelector appears when the selected matrix
          // has categorical values. But "sort by" really belongs with "Group
          // by" and not "Color by".
          sortByValue={sort_by}
          onChangeSortBy={() => {}}
        />
      )}
    </div>
  );
}

export default TranscriptColorByViewOptions;
