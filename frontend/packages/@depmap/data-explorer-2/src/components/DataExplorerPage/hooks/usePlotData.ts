import { useEffect, useState } from "react";
import { dataExplorerAPI } from "../../../services/dataExplorerAPI";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
  ErrorTypeError,
  LinRegInfo,
} from "@depmap/types";

export default function usePlotData(plotConfig: DataExplorerPlotConfig | null) {
  const [data, setData] = useState<DataExplorerPlotResponse | null>(null);
  const [linreg_by_group, setLinRegInfoByGroup] = useState<LinRegInfo[] | null>(
    null
  );
  const [
    // HACK: The distinction between `plotConfig` and `fetchedPlotConfig`
    // exists so stale content can be shown while new content is being fetched.
    // However, this is an admittedly confusing way to achieve that. React 18
    // has a pattern for this called `useDeferredValue`.
    fetchedPlotConfig,
    setFetchedPlotConfig,
  ] = useState<DataExplorerPlotConfig | null>(null);
  const [hadError, setHadError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    (async () => {
      if (!plotConfig) {
        setData(null);
        setFetchedPlotConfig(null);
        setHadError(false);
        return;
      }

      if (fetchedPlotConfig === plotConfig) {
        return;
      }

      if (
        fetchedPlotConfig &&
        fetchedPlotConfig.plot_type !== plotConfig.plot_type
      ) {
        // Clear out the data whenever the plot type is changed. We do this
        // because we try to keep the plot rendered in the background (even
        // while loading new data). However, that makes no sense to do with
        // incompatible plots.
        setData(null);
      }

      try {
        setHadError(false);
        let fetchedData: DataExplorerPlotResponse;

        if (plotConfig.plot_type === "correlation_heatmap") {
          fetchedData = await dataExplorerAPI.fetchCorrelation(
            plotConfig.index_type,
            plotConfig.dimensions,
            plotConfig.filters,
            plotConfig.use_clustering
          );
        } else if (plotConfig.plot_type === "waterfall") {
          fetchedData = await dataExplorerAPI.fetchWaterfall(
            plotConfig.index_type,
            plotConfig.dimensions,
            plotConfig.filters,
            plotConfig.metadata
          );
        } else {
          fetchedData = await dataExplorerAPI.fetchPlotDimensions(
            plotConfig.index_type,
            plotConfig.dimensions,
            plotConfig.filters,
            plotConfig.metadata
          );
        }

        setData(fetchedData);
        setFetchedPlotConfig(plotConfig);
      } catch (e) {
        setHadError(true);
        window.console.error(e);

        if (e && typeof e === "object" && "message" in e) {
          // Distinguish Error from ErrorTypeError
          if (e instanceof ErrorTypeError) {
            if (e.name === "LARGE_DATASET_READ") {
              setErrorMessage(
                "This operation cannot be completed because the region requested from the dataset is too large."
              );
            }
          } else {
            setErrorMessage(e.message as string);
          }
        } else {
          setErrorMessage("");
        }
      }
    })();
  }, [plotConfig, fetchedPlotConfig]);

  useEffect(() => {
    setLinRegInfoByGroup(null);

    (async () => {
      if (
        plotConfig &&
        plotConfig.show_regression_line &&
        plotConfig.dimensions.x &&
        plotConfig.dimensions.y
      ) {
        const fetchedData = await dataExplorerAPI.fetchLinearRegression(
          plotConfig.index_type,
          plotConfig.dimensions,
          plotConfig.filters,
          plotConfig.metadata
        );

        // Double check that these match (the user could've tweaked the config
        // while this request was still in flight).
        if (plotConfig === fetchedPlotConfig) {
          setLinRegInfoByGroup(fetchedData);
        }
      }
    })();
  }, [plotConfig, fetchedPlotConfig]);

  return { data, linreg_by_group, fetchedPlotConfig, hadError, errorMessage };
}
