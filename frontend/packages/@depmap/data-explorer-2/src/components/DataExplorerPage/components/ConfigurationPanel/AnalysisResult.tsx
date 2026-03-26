import React, { useCallback, useEffect, useState } from "react";
import qs from "qs";
import omit from "lodash.omit";
import { Button } from "react-bootstrap";
import { breadboxAPI, cached } from "@depmap/api";
import { Spinner } from "@depmap/common-components";
import { CustomAnalysisResult } from "@depmap/compute";
import { isElara } from "@depmap/globals";
import {
  ComputeResponseResult,
  Dataset,
  DimensionType,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { usePlotlyLoader } from "../../../../contexts/PlotlyLoaderContext";
import { PlotConfigReducerAction } from "../../reducers/plotConfigReducer";
import Section from "../Section";
import styles from "../../styles/ConfigurationPanel.scss";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  dispatch: (action: PlotConfigReducerAction) => void;
}

function resolveMetadataGivenId(
  dimensionTypeName: string,
  dimTypes: DimensionType[],
  datasets: Dataset[]
): string | undefined {
  const dimType = dimTypes.find((dt) => dt.name === dimensionTypeName);
  if (!dimType) return undefined;

  const dataset = datasets.find((ds) => ds.id === dimType.metadata_dataset_id);
  return dataset?.given_id || dataset?.id || undefined;
}

function AnalysisResult({ plot, dispatch }: Props) {
  const PlotlyLoader = usePlotlyLoader();
  const [taskId, setTaskId] = useState<string | null>(null);
  const [result, setResult] = useState<ComputeResponseResult | null>(null);
  const [sliceType, setSliceType] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading"
  );

  // `controlledLabel` is used to control the selection state of the
  // AnalysisResult component. Note that it uses label instead of id for
  // historical reasons.
  const [controlledLabel, setControlledLabel] = useState("");

  useEffect(() => {
    if (!result) {
      return;
    }

    const dimensionKey = result.analysisType === "two_class" ? "x" : "y";
    const expr = plot.dimensions?.[dimensionKey]?.context?.expr;

    if (expr !== null && typeof expr === "object" && "==" in expr) {
      const varExpr = (expr["=="]![0] as unknown) as { var: string };
      const valueExpr = (expr["=="]![1] as unknown) as string;
      let label = "";

      if (varExpr?.var === "entity_label") {
        label = valueExpr;
      } else {
        const dataIndex = result.data.findIndex(({ vectorId }) => {
          const entityId = vectorId.split("/")[2];
          return entityId === valueExpr;
        });

        if (dataIndex !== -1) {
          label = result.data[dataIndex].label;
        }
      }

      setControlledLabel(label);
    }
  }, [plot.dimensions, result]);

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
      setSliceType(null);
      setStatus("loaded");
      return;
    }

    (async () => {
      setStatus("loading");

      try {
        const task = await cached(breadboxAPI).getTaskStatus(taskId);
        const analysisResult = task.result;
        setResult(analysisResult);

        const nextSliceType: string | null = analysisResult?.entityType || null;
        setSliceType(nextSliceType);
        setStatus("loaded");
      } catch (e) {
        setStatus("error");
        window.console.error(e);
      }
    })();
  }, [taskId]);

  const clearAnalysis = useCallback(() => {
    const params = qs.parse(window.location.search.substr(1));
    const queryString = qs.stringify(omit(params, "task", "analysis"));
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
    if (status === "error") {
      return (
        <Section title="Analysis Result">
          <p>Sorry, there was an error retrieving the analysis result.</p>
        </Section>
      );
    }

    const baseUrl = isElara ? "../elara/custom_analysis" : "../custom_analyses";

    // The Custom Analyses page embeds an encoded version of all its
    // parameters into the query string so it can be easily re-run.
    const params = new URLSearchParams(window.location.search);
    const base64EncodedQs = params.get("analysis");
    const queryString = base64EncodedQs ? atob(base64EncodedQs) : "";

    return (
      <Section title="Analysis Result">
        <p>Sorry, this analysis is no longer available.</p>
        <Button bsStyle="default" onClick={clearAnalysis}>
          Dismiss
        </Button>
        <Button
          href={`${baseUrl}?${queryString}`}
          style={{ marginLeft: 10 }}
          bsStyle="primary"
        >
          Re-run analysis
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              Plotly={Plotly as any}
              result={result}
              analysisType={result.analysisType}
              queryLimit={1000}
              controlledLabel={controlledLabel}
              onLabelClick={async (slice_label) => {
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
                  result.data[0].vectorId.split("/")?.[1]
                );

                const dimTypes = await cached(breadboxAPI).getDimensionTypes();
                const datasets = await cached(breadboxAPI).getDatasets();
                const metadataDataset = resolveMetadataGivenId(
                  sliceType!,
                  dimTypes,
                  datasets
                );

                if (!metadataDataset) {
                  window.console.warn(
                    "Could not find metadata dataset for dimension type",
                    `"${sliceType}".`
                  );
                  return;
                }

                const context = {
                  name: slice_label,
                  dimension_type: sliceType,
                  expr: { "==": [{ var: "entity_label" }, slice_label] },
                  vars: {
                    entity_label: {
                      dataset_id: metadataDataset,
                      identifier_type: "column" as const,
                      identifier: "label",
                    },
                  },
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
                        axis_type: "raw_slice",
                        aggregation: "first",
                        slice_type: sliceType,
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
