import React, { useCallback, useEffect, useRef, useState } from "react";
import cx from "classnames";
import {
  fetchLinearRegression,
  renderConditionally,
} from "@depmap/data-explorer-2";
import { PartialDataExplorerPlotConfig } from "@depmap/types";
import { PlotConfigReducerAction } from "src/data-explorer-2/reducers/plotConfigReducer";
import { isCompletePlot } from "src/data-explorer-2/utils";
import Section from "src/data-explorer-2/components/Section";
import { ShowRegressionLineCheckbox } from "src/data-explorer-2/components/ConfigurationPanel/selectors";
import { Spinner } from "@depmap/common-components";
import { reformatLinRegTable, StaticTable } from "@depmap/interactive";
import styles from "src/data-explorer-2/styles/ConfigurationPanel.scss";

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
          const linreg_by_group = await fetchLinearRegression(
            plot.index_type,
            plot.dimensions,
            plot.filters,
            plot.metadata
          );

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
