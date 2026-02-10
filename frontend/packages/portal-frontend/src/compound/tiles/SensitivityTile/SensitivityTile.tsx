import React from "react";
import styles from "../CompoundTiles.scss";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ErrorLoading from "../ErrorLoading";
import GenericDistributionPlot from "src/plot/components/GenericDistributionPlot";
import useSensitivityTileData from "../hooks/useSensitivityTileData";
import { MatrixDataset } from "@depmap/types";

interface SensitivityTileProps {
  compoundId: string;
  dataset: MatrixDataset;
}

const formatDepDistWarnings = (dataset: MatrixDataset): string | null => {
  const datasetGivenId = dataset.given_id || dataset.id;
  let s = "";

  if (dataset.units === "log2(AUC)") {
    s +=
      "Please note that log2(AUC) values depend on the dose range of the screen and are not comparable across different assays. ";
  }

  if (dataset.units === "AUC") {
    s +=
      "Please note that AUC values depend on the dose range of the screen and are not comparable across different assays.";
  }

  if (datasetGivenId.includes("CTRP_AUC")) {
    s +=
      " Additionally, CTRP AUCs are not normalized by the dose range and thus have values greater than 1.";
  }

  // Return the trimmed string if it's not empty, otherwise null
  return s !== "" ? s.trim() : null;
};

export const SensitivityTile: React.FC<SensitivityTileProps> = ({
  compoundId,
  dataset,
}) => {
  const { sliceValues, error, isLoading } = useSensitivityTileData(
    compoundId,
    dataset.given_id!
  );
  const numberOfCellLines = sliceValues ? sliceValues.length : 0;

  const warningText = formatDepDistWarnings(dataset);

  const sensitvityTabHref = (() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "sensitivity");
    return url.pathname + url.search;
  })();

  if (!isLoading && error) {
    return <ErrorLoading tileName="Sensitive Cell Lines" />;
  }

  return (
    <article
      className={`${styles.SensitivityTile} card_wrapper stacked-boxplot-tile`}
    >
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">Sensitive Cell Lines</h2>
        <div className="card_padding">
          {!isLoading && !error && sliceValues && (
            <div className={styles.subHeader}>
              {numberOfCellLines} of Cell Lines Shown
            </div>
          )}
          {isLoading && !error && <PlotSpinner />}
          {!isLoading && !error && sliceValues && (
            <div className={styles.heatmapWithTriangle}>
              <div className={styles.heatmapContainer}>
                <GenericDistributionPlot values={sliceValues} color="blue" />
              </div>
            </div>
          )}
          <hr className={styles.heatmapSeparator} />
          {sliceValues && (
            <div>
              <p>{warningText}</p>
              <p className="stacked-boxplot-download-container">
                View details in{" "}
                <a href={sensitvityTabHref} className={styles.buttonLink}>
                  Sensitivity Tab
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
