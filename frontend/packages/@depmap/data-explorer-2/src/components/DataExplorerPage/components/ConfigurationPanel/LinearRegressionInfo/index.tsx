import React, { useCallback, useEffect, useRef, useState } from "react";
import cx from "classnames";
import { Spinner } from "@depmap/common-components";
import { dataExplorerAPI } from "../../../../../services/dataExplorerAPI";
import { StaticTable } from "./StaticTable";
import { reformatLinRegTable } from "./reformatLinRegTable";
import { PartialDataExplorerPlotConfig, LinRegInfo } from "@depmap/types";
import {
  computeFacetedLinReg,
  computePooledLinReg,
  resolveColorMode,
} from "../../plot/prototype/plotUtils";
import renderConditionally from "../../../../../utils/render-conditionally";
import { PlotConfigReducerAction } from "../../../reducers/plotConfigReducer";
import { isCompletePlot } from "../../../validation";
import Section from "../../Section";
import { canShowRegressionLinePerColor } from "../../../utils";
import {
  ShowRegressionLineCheckbox,
  ShowRegressionLinePerColorCheckbox,
} from "../selectors";
import styles from "../../../styles/ConfigurationPanel.scss";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  dispatch: (action: PlotConfigReducerAction) => void;
}

function LinearRegressionTable({
  plot,
  onLoad,
}: {
  plot: PartialDataExplorerPlotConfig;
  onLoad: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [table, setTable] = useState<ReturnType<
    typeof reformatLinRegTable
  > | null>(null);

  useEffect(() => {
    (async () => {
      setTable(null);

      if (plot.plot_type === "scatter" && isCompletePlot(plot)) {
        try {
          setLoading(true);

          // Faceted (facet_by set): the regression follows the facets, so the
          // table's rows are the per-facet fits — derived from the materialized
          // response, the same faceting the drawn lines use. Single-panel keeps
          // the color-faceted fit from fetchLinearRegression.
          let linreg_by_group: LinRegInfo[];
          if (plot.facet_by) {
            // Faceted: source the points the same way the plot does. An
            // expanded plot (e.g. facet_by "expansion") carries its per-point
            // facet labels only in the expanded response's `expansions`, which
            // the plain fetcher omits — so mirror usePlotData's dispatch and
            // use the expanded fetcher whenever the plot is expanded.
            const facetData =
              "expand_by" in plot
                ? await dataExplorerAPI.fetchExpandedPlot(plot as any)
                : await dataExplorerAPI.fetchPlotDimensions(
                    plot.index_type,
                    plot.dimensions,
                    plot.filters,
                    plot.metadata
                  );
            linreg_by_group = computeFacetedLinReg(facetData, plot.facet_by);
          } else if ("expand_by" in plot) {
            // Expanded + ungrouped: fetchLinearRegression rejects the
            // "expansion" sentinel (its color-faceted fit assumes one value
            // per entity, but an expansion axis is N×M). Mirror the drawn
            // line's own fallback (regressionLines in useScatterPlotData.ts):
            // facet by color_by's own triad when it resolves to something
            // real (categorical/custom-filter — never continuous, matching
            // fetchLinearRegression's own behavior), otherwise a single
            // pooled fit — the table analog of the single pooled regression
            // line the plot draws in that case.
            const facetData = await dataExplorerAPI.fetchExpandedPlot(
              plot as any
            );
            const colorMode = resolveColorMode(plot);
            const colorRows = colorMode.mode
              ? computeFacetedLinReg(
                  facetData,
                  colorMode.mode,
                  undefined,
                  colorMode.target
                )
              : [];
            linreg_by_group =
              colorRows.length > 0 ? colorRows : computePooledLinReg(facetData);
          } else {
            linreg_by_group = await dataExplorerAPI.fetchLinearRegression(
              plot.index_type,
              plot.dimensions,
              plot.filters,
              plot.metadata
            );
          }

          const nextTable = reformatLinRegTable(linreg_by_group)?.map((row) => {
            return row.map((cell: string | number, i: number) => {
              if (i === 0 && cell === null) {
                return "Other";
              }

              return typeof cell === "string"
                ? cell.replace("Number of Points", "Points")
                : cell;
            });
          });

          setTable(nextTable);
          onLoad();
        } catch (e) {
          window.console.error(e);
        } finally {
          setLoading(false);
        }
      }
    })();
  }, [plot, onLoad]);

  return (
    <div
      data-inner-scroll
      className={cx(styles.linearRegressionTable, {
        [styles.freezeFirstColumn]: table ? table.length > 2 : null,
      })}
    >
      {table && <StaticTable data={table} />}
      {loading && (
        <Spinner
          className={styles.linregSpinner}
          left="0px"
          position="static"
        />
      )}
    </div>
  );
}

function LinearRegressionInfo({ plot, dispatch }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const scrollOnLoad = useRef(false);

  const scrollParent = () => {
    if (ref.current) {
      const configPanel = ref.current.parentElement as Element;

      setTimeout(() => {
        configPanel.scrollTo({
          top: configPanel.scrollHeight,
          behavior: "smooth",
        });
      }, 0);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    scrollOnLoad.current = true;
    scrollParent();
  };

  const onLoad = useCallback(() => {
    if (scrollOnLoad.current) {
      scrollOnLoad.current = false;
      scrollParent();
    }
  }, []);

  return (
    <Section
      title="Linear Regression"
      defaultOpen={false}
      innerRef={ref}
      onOpen={handleOpen}
      onClose={() => setOpen(false)}
    >
      <ShowRegressionLineCheckbox
        show
        value={plot.show_regression_line || false}
        onChange={(show_regression_line: boolean) => {
          dispatch({
            type: "select_show_regression_line",
            payload: show_regression_line,
          });
        }}
      />
      {/* Deliberately NOT also gated on `show_regression_line`: the two are
          independent settings that happen to compose, and hiding this one
          while lines are off would silently discard a choice the user made
          (the reducer's normalize only drops it when the color/facet partitions
          themselves stop supporting it). Offered whenever it can apply. */}
      <ShowRegressionLinePerColorCheckbox
        show={canShowRegressionLinePerColor(plot)}
        value={plot.show_regression_line_per_color || false}
        onChange={(show_regression_line_per_color: boolean) => {
          dispatch({
            type: "select_show_regression_line_per_color",
            payload: show_regression_line_per_color,
          });
        }}
      />
      {open && <LinearRegressionTable plot={plot} onLoad={onLoad} />}
    </Section>
  );
}

export default renderConditionally(LinearRegressionInfo);
