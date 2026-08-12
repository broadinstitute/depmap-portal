import React, { useEffect, useState } from "react";
import { ContextPath, DataExplorerContextV2, FilterKey } from "@depmap/types";
import ContextSelectorV2 from "../../../ContextSelectorV2";
import DimensionSliceSelect from "../../../DimensionSelectV2/DimensionSliceSelect";
import { useDataExplorerSettings } from "../../../../contexts/DataExplorerSettingsContext";
import { dataExplorerAPI } from "../../../../services/dataExplorerAPI";
import { PlotConfigReducerAction } from "../../reducers/plotConfigReducer";
import { resolveColorMode } from "../plot/prototype/plotUtils";
import {
  ColorByDimensionSelect,
  FacetByTypeSelector,
  SortBySelector,
} from "./selectors";
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

function FacetByViewOptions({
  show,
  plot,
  dispatch,
  onClickCreateContext,
  onClickSaveAsContext,
}: Props) {
  const { plotStyles } = useDataExplorerSettings();
  const { palette } = plotStyles;

  // Whether "Sort facets by" should appear at all: sort_by is genuinely
  // meaningless for raw_slice/aggregated_slice (the dual-filter partition's
  // order is always the fixed [filter1, filter2, Both, Other] canonical
  // order, never sort_by), and for scatter (never faceted/ordered by
  // sort_by). For property/custom it depends on whether the resolved data
  // is actually categorical — continuous data uses natural ascending bin
  // order and ignores sort_by. A metadata column's col_type can now be
  // "continuous", so "property implies categorical" is no longer a safe
  // assumption. fetchValueType already resolves both a dimension (custom)
  // and a SliceQuery (property) uniformly, and safely defaults to
  // "continuous" (i.e. hide) for an incomplete/invalid selection — which
  // also covers "facet_by choice isn't finished yet" for free. "expansion" is
  // always categorical (no fetch needed) — handled as its own branch below.
  const [isFacetCategorical, setIsFacetCategorical] = useState(false);

  useEffect(() => {
    if (!["density_1d", "waterfall"].includes(plot.plot_type)) {
      setIsFacetCategorical(false);
      return;
    }

    if (plot.facet_by === "expansion") {
      setIsFacetCategorical(true);
      return;
    }

    if (plot.facet_by === "property" || plot.facet_by === "custom") {
      const query =
        plot.facet_by === "property"
          ? plot.metadata?.facet_property
          : plot.dimensions?.facet;

      dataExplorerAPI.fetchValueType(query).then((valueType: string | null) => {
        // A matrix dataset's value_type can come back null (unset/legacy
        // data) — treat that the same as "continuous" (don't show sort)
        // rather than assuming it's sortable.
        setIsFacetCategorical(valueType !== null && valueType !== "continuous");
      });
      return;
    }

    setIsFacetCategorical(false);
  }, [
    plot.plot_type,
    plot.facet_by,
    plot.metadata?.facet_property,
    plot.dimensions?.facet,
  ]);

  if (!show) {
    return null;
  }

  const {
    index_type,
    plot_type,
    facet_by,
    sort_by,
    dimensions,
    filters,
    metadata,
    expand_by,
  } = plot;

  const dataset_id =
    dimensions?.x?.dataset_id || dimensions?.y?.dataset_id || null;

  // Facet swatches (facet1/facet2) are only meaningful when color_by is
  // deferring to facet_by ("Match Facet By", including the absent-color_by
  // default) — that's the one case where picking a facet actually results
  // in it being represented by a color. If color_by is set to something
  // else, the plot's colors come from a different source entirely, so a
  // swatch here would misleadingly imply a color that isn't real.
  const facetColorsAreRepresented = resolveColorMode(plot).target === "facet";

  return (
    <div className={styles.FacetByViewOptions}>
      <FacetByTypeSelector
        show
        enable={Boolean(index_type)}
        value={facet_by || null}
        index_type={index_type as string}
        expansionSliceType={expand_by?.[0]?.slice_type}
        onChange={(nextFacetBy) =>
          dispatch({
            type: "select_facet_by",
            payload: nextFacetBy,
          })
        }
      />
      <div className={styles.colorByContext}>
        {(["facet1", "facet2"] as FilterKey[]).map((filterKey, i) => {
          const swatchColor = facetColorsAreRepresented
            ? palette[filterKey === "facet1" ? "compare1" : "compare2"]
            : undefined;

          return (
            <React.Fragment key={filterKey}>
              <DimensionSliceSelect
                show={facet_by === "raw_slice"}
                label={`Facet ${i + 1}`}
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
                swatchColor={swatchColor}
              />
              <ContextSelectorV2
                label={`Facet ${i + 1}`}
                show={facet_by === "aggregated_slice"}
                enable={facet_by === "aggregated_slice"}
                value={filters?.[filterKey]}
                dimension_type={index_type}
                swatchColor={swatchColor}
                linkToContextManager
                onClickCreateContext={() => {
                  onClickCreateContext(["filters", filterKey]);
                }}
                onClickSaveAsContext={() =>
                  onClickSaveAsContext(filters[filterKey], [
                    "filters",
                    filterKey,
                  ])
                }
                onChange={(filter) => {
                  dispatch({
                    type: "select_filter",
                    payload: { key: filterKey, filter },
                  });
                }}
              />
            </React.Fragment>
          );
        })}
      </div>
      <ColorByAnnotationSelect
        show={facet_by === "property"}
        dimension_type={index_type as string}
        value={metadata?.facet_property}
        onChange={(sliceQuery) => {
          dispatch({
            type: "select_facet_property",
            payload: sliceQuery,
          });
        }}
        onConvertToColorContext={(context) => {
          dispatch({
            type: "batch",
            payload: [
              { type: "select_facet_by", payload: "aggregated_slice" },
              {
                type: "select_filter",
                payload: {
                  key: "facet1" as FilterKey,
                  filter: (context as unknown) as DataExplorerContextV2,
                },
              },
            ],
          });
        }}
      />
      {facet_by === "custom" && (
        <ColorByDimensionSelect
          plot_type={plot_type}
          index_type={plot.index_type || null}
          value={dimensions.facet || null}
          onChange={(dimension) => {
            dispatch({
              type: "select_dimension",
              payload: { key: "facet", dimension },
            });
          }}
          onClickCreateContext={() => {
            const path: ContextPath = ["dimensions", "facet", "context"];
            onClickCreateContext(path);
          }}
          onClickSaveAsContext={() => {
            const path: ContextPath = ["dimensions", "facet", "context"];
            const context = plot.dimensions.facet.context;
            onClickSaveAsContext(context, path);
          }}
        />
      )}
      <SortBySelector
        show={isFacetCategorical}
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
  );
}

export default FacetByViewOptions;
