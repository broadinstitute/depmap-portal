import React, { useEffect } from "react";
import { ContextPath, DataExplorerContextV2, FilterKey } from "@depmap/types";
import ContextSelectorV2 from "../../../ContextSelectorV2";
import DimensionSliceSelect from "../../../DimensionSelectV2/DimensionSliceSelect";
import { useDataExplorerSettings } from "../../../../contexts/DataExplorerSettingsContext";
import { PlotConfigReducerAction } from "../../reducers/plotConfigReducer";
import { ColorByTypeSelector, ColorByDimensionSelect } from "./selectors";
import ColorByAnnotationSelect from "./ColorByAnnotationSelect";
import styles from "../../styles/ConfigurationPanel.scss";

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

function ColorByViewOptions({
  show,
  plot,
  dispatch,
  onClickCreateContext,
  onClickSaveAsContext,
}: Props) {
  const { plotStyles } = useDataExplorerSettings();
  const { palette } = plotStyles;

  // This selector no longer offers "Uniform" as a choice (see
  // ColorByTypeSelector), but the value can still arrive from outside this
  // UI, via two real, currently-active producers — not a hypothetical:
  // (1) a shorthand link (inferColorBy, query-string-parser.ts) with no
  // color context mints "uniform" explicitly, since shorthand links have no
  // way to express facet_by and an absent color_by now means "facet"; and
  // (2) an old pre-v2 bookmark gets it written on read by the v1->v2
  // migration (readPlotFromQueryString), preserving what absent color_by
  // used to mean before "facet" became the default. Coerce it back to
  // absent (which resolves to "facet") the moment it's observed, rather
  // than letting it silently survive every serialize/deserialize
  // round-trip — normalizePlot preserves "uniform" unconditionally by
  // design (it has to, for consumers other than this one), so this
  // component must be the one to actively let go of it. Runs for any
  // render where it's seen (initial load, or back/forward navigation to
  // such a URL); once dispatched, color_by is no longer "uniform" so this
  // does not loop.
  useEffect(() => {
    if (plot.color_by === "uniform") {
      dispatch({ type: "select_color_by", payload: undefined });
    }
  }, [plot.color_by, dispatch]);

  if (!show) {
    return null;
  }

  const {
    index_type,
    plot_type,
    color_by,
    dimensions,
    filters,
    metadata,
    expand_by,
  } = plot;

  const dataset_id =
    dimensions?.x?.dataset_id || dimensions?.y?.dataset_id || null;

  return (
    <div className={styles.ColorByViewOptions}>
      <ColorByTypeSelector
        show
        enable={Boolean(index_type)}
        // Always show a concrete option: absent color_by resolves to
        // "facet" (the version 2 default), and a stray "uniform" (no
        // longer a selectable option here) is displayed as "facet" too,
        // immediately, without waiting for the coercion effect above to
        // commit the actual dispatch.
        value={color_by && color_by !== "uniform" ? color_by : "facet"}
        index_type={index_type as string}
        expansionSliceType={expand_by?.[0]?.slice_type}
        onChange={(nextColorBy) =>
          dispatch({
            type: "select_color_by",
            payload: nextColorBy,
          })
        }
      />
      <div className={styles.colorByContext}>
        {(["color1", "color2"] as FilterKey[]).map((filterKey, i) => (
          <React.Fragment key={filterKey}>
            <DimensionSliceSelect
              label={`Color ${i + 1}`}
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
              label={`Color ${i + 1}`}
              show={color_by === "aggregated_slice"}
              enable={color_by === "aggregated_slice"}
              value={filters?.[filterKey]}
              dimension_type={index_type}
              linkToContextManager
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
        />
      )}
    </div>
  );
}

export default ColorByViewOptions;
