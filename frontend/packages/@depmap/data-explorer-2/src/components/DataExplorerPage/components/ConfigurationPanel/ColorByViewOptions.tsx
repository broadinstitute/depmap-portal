import React from "react";
import { ContextPath, DataExplorerContext, FilterKey } from "@depmap/types";
import { isBreadboxOnlyMode } from "../../../../isBreadboxOnlyMode";
import ContextSelector from "../../../ContextSelector";
import DatasetMetadataSelector from "../../../DatasetMetadataSelector";
import SliceLabelSelectV1 from "../../../DimensionSelect/SliceLabelSelect";
import SliceLabelSelectV2 from "../../../DimensionSelectV2/SliceSelect";
import { useDataExplorerSettings } from "../../../../contexts/DataExplorerSettingsContext";
import { PlotConfigReducerAction } from "../../reducers/plotConfigReducer";
import {
  ColorByTypeSelector,
  ColorByDimensionSelect,
  SortBySelector,
} from "./selectors";
import ColorByAnnotationSelect from "./ColorByAnnotationSelect";
import styles from "../../styles/ConfigurationPanel.scss";

const SliceLabelSelect = isBreadboxOnlyMode
  ? ((SliceLabelSelectV2 as unknown) as typeof SliceLabelSelectV1)
  : SliceLabelSelectV1;

interface Props {
  show: boolean;
  plot: any;
  dispatch: (action: PlotConfigReducerAction) => void;
  onClickCreateContext: (pathToCreate: ContextPath) => void;
  onClickSaveAsContext: (
    contextToEdit: DataExplorerContext,
    pathToSave: ContextPath
  ) => void;
}

function ColorByViewOptions({
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
    <div className={styles.ColorByViewOptions}>
      <hr className={styles.hr} />
      <ColorByTypeSelector
        show
        enable={Boolean(index_type)}
        value={color_by || null}
        plot_type={plot_type}
        slice_type={index_type as string}
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
            <SliceLabelSelect
              show={color_by === "raw_slice"}
              units={null}
              dataType={null}
              dataset_id={dataset_id}
              slice_type={index_type as string}
              value={filters?.[filterKey]}
              onChange={(filter) => {
                dispatch({
                  type: "select_filter",
                  payload: { key: filterKey, filter },
                });
              }}
              swatchColor={
                filterKey === "color1" ? palette.compare1 : palette.compare2
              }
            />
            <ContextSelector
              show={color_by === "aggregated_slice"}
              enable={color_by === "aggregated_slice"}
              value={filters?.[filterKey]}
              context_type={index_type}
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
      <DatasetMetadataSelector
        show={!isBreadboxOnlyMode && color_by === "property"}
        enable={color_by === "property"}
        slice_type={index_type}
        value={metadata?.color_property?.slice_id}
        onChange={(slice_id: string | null) => {
          dispatch({
            type: "select_legacy_color_property",
            payload: { slice_id },
          });
        }}
      />
      <ColorByAnnotationSelect
        show={isBreadboxOnlyMode && color_by === "property"}
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
                  filter: (context as unknown) as DataExplorerContext,
                },
              },
            ],
          });
        }}
      />
      <div className={styles.sortByContainer}>
        <SortBySelector
          show={
            color_by === "property" &&
            ["density_1d", "waterfall"].includes(plot_type)
          }
          enable
          value={sort_by}
          onChange={(next_sort_by) => {
            dispatch({
              type: "select_sort_by",
              payload: next_sort_by,
            });
          }}
        />
      </div>
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
          // A secondary SortBySelector appears only when the selected matrix
          // has categorical values (only supported in "Breadbox mode").
          sortByValue={sort_by}
          onChangeSortBy={(next_sort_by) => {
            dispatch({
              type: "select_sort_by",
              payload: next_sort_by,
            });
          }}
        />
      )}
    </div>
  );
}

export default ColorByViewOptions;
