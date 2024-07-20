import React, { useCallback, useEffect, useState } from "react";
import qs from "qs";
import omit from "lodash.omit";
import { Button } from "react-bootstrap";
import { Spinner } from "@depmap/common-components";
import { ComputeResponseResult, CustomAnalysisResult } from "@depmap/compute";
import PlotlyLoader from "src/data-explorer-2/components/plot/PlotlyLoader";
import {
  DataExplorerPlotConfigDimension,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { fetchAnalysisResult } from "@depmap/data-explorer-2";
import { PlotConfigReducerAction } from "src/data-explorer-2/reducers/plotConfigReducer";
import Section from "src/data-explorer-2/components/Section";
import styles from "src/data-explorer-2/styles/ConfigurationPanel.scss";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  dispatch: (action: PlotConfigReducerAction) => void;
}

const labelFromDimension = (dimension: DataExplorerPlotConfigDimension) => {
  if (typeof dimension?.context?.expr === "object") {
    const { expr } = dimension.context;
    return expr?.["=="]?.[1] || null;
  }

  return null;
};

function AnalysisResult({ plot, dispatch }: Props) {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [result, setResult] = useState<ComputeResponseResult | null>(null);
  const [entityType, setEntityType] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading"
  );

  useEffect(() => {
    const params = qs.parse(window.location.search.substr(1));

    if (params.task) {
      setTaskId(params.task as string);
    } else {
      setTaskId(null);
    }
  }, [plot]);

  useEffect(() => {
    if (!taskId) {
      setResult(null);
      setEntityType(null);
      setStatus("loaded");
      return;
    }

    (async () => {
      setStatus("loading");

      try {
        const analysisResult = await fetchAnalysisResult(taskId);

        setResult(analysisResult);
        setEntityType(analysisResult?.entityType || "custom");
        setStatus("loaded");
      } catch (e) {
        setStatus("error");
        window.console.error(e);
      }
    })();
  }, [taskId]);

  const clearAnalysis = useCallback(() => {
    const params = qs.parse(window.location.search.substr(1));
    const queryString = qs.stringify(omit(params, "task"));
    window.history.pushState({}, "", `?${queryString}`);
    setTaskId(null);
  }, []);

  if (!taskId) {
    return null;
  }

  if (status === "loading") {
    return (
      <Section title="Analysis Result">
        <Spinner position="static" />
      </Section>
    );
  }

  if (!result) {
    return (
      <Section title="Analysis Result">
        {status === "error" ? (
          <p>Sorry, there was an error retrieving the analysis result.</p>
        ) : (
          <p>Sorry, this analysis is no longer available.</p>
        )}
        <p>
          Try <a href="../interactive/custom_analysis">running it again</a>.
        </p>
        <Button bsStyle="primary" onClick={clearAnalysis}>
          Dismiss
        </Button>
      </Section>
    );
  }

  const dimensionKey = result.analysisType === "two_class" ? "x" : "y";

  return (
    <Section title="Analysis Result" className={styles.AnalysisResult}>
      <PlotlyLoader version="module">
        {(Plotly) => (
          <div>
            <div className={styles.closeAnalysis}>
              <button className="close" type="button" onClick={clearAnalysis}>
                <span aria-hidden="true">&times;</span>
                <span className="sr-only">Close</span>
              </button>
            </div>
            <CustomAnalysisResult
              Plotly={Plotly}
              result={result}
              analysisType={result.analysisType}
              queryLimit={1000}
              controlledLabel={labelFromDimension(
                plot.dimensions![
                  dimensionKey
                ] as DataExplorerPlotConfigDimension
              )}
              onLabelClick={(entity_label) => {
                let plot_type =
                  dimensionKey === "y" ? "scatter" : plot.plot_type;

                if (
                  plot_type !== "density_1d" &&
                  plot_type !== "waterfall" &&
                  plot_type !== "scatter"
                ) {
                  plot_type =
                    result.analysisType === "two_class"
                      ? "density_1d"
                      : "scatter";
                }

                const dataset_id = decodeURIComponent(
                  result.data[0].vectorId.replace(/slice\/([^/]+)\/.*/, "$1")
                );

                const context = {
                  name: entity_label,
                  context_type: entityType,
                  expr: { "==": [{ var: "entity_label" }, entity_label] },
                };

                dispatch({
                  type: "set_plot",
                  payload: {
                    ...plot,
                    plot_type,
                    index_type: "depmap_model",
                    dimensions: {
                      ...plot.dimensions,
                      [dimensionKey]: {
                        axis_type: "entity",
                        aggregation: "first",
                        entity_type: entityType,
                        dataset_id,
                        context,
                      },
                    },
                  },
                });
              }}
            />
          </div>
        )}
      </PlotlyLoader>
    </Section>
  );
}

export default AnalysisResult;
