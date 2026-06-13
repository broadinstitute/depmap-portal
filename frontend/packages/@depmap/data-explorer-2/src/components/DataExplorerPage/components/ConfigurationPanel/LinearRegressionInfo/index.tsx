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
} from "../../plot/prototype/plotUtils";
import renderConditionally from "../../../../../utils/render-conditionally";
import { PlotConfigReducerAction } from "../../../reducers/plotConfigReducer";
import { isCompletePlot } from "../../../validation";
import Section from "../../Section";
import { ShowRegressionLineCheckbox } from "../selectors";
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

          // Faceted (group_by set): the regression follows the facets, so the
          // table's rows are the per-facet fits — derived from the materialized
          // response, the same grouping the drawn lines use. Single-panel keeps
          // the color-grouped fit from fetchLinearRegression.
          let linreg_by_group: LinRegInfo[];
          if (plot.group_by) {
            // Faceted: source the points the same way the plot does. An
            // expanded plot (e.g. group_by "expansion") carries its per-point
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
            linreg_by_group = computeFacetedLinReg(facetData, plot.group_by);
          } else if ("expand_by" in plot) {
            // Expanded + ungrouped: fetchLinearRegression rejects the
            // "expansion" sentinel (its color-grouped fit assumes one value
            // per entity, but an expansion axis is N×M). Compute one pooled
            // fit from the expanded response instead — the table analog of
            // the single pooled regression line the plot draws.
            const facetData = await dataExplorerAPI.fetchExpandedPlot(
              plot as any
            );
            linreg_by_group = computePooledLinReg(facetData);
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
      {open && <LinearRegressionTable plot={plot} onLoad={onLoad} />}
    </Section>
  );
}

export default renderConditionally(LinearRegressionInfo);
