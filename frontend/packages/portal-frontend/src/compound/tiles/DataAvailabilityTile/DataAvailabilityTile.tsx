import React, { useState } from "react";
import { toStaticUrl } from "@depmap/globals";
import styles from "../CompoundTiles.scss";
import useDataAvailabilityTileData from "../hooks/useDataAvailabilityTileData";
import { MatrixDataset } from "@depmap/types";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ErrorLoading from "../ErrorLoading";
import InfoIcon from "src/common/components/InfoIcon";

interface DatasetAvailabilityTileProps {
  compoundName: string;
  compoundId: string;
  datasets: MatrixDataset[];
}

const customInfoImg = (
  <img
    style={{
      height: "13px",
      margin: "1px 3px 4px",
      cursor: "pointer",
    }}
    src={toStaticUrl("img/gene_overview/info_purple.svg")}
    alt="description of term"
    className="icon"
  />
);

const DatasetName = ({
  datasetUrl,
  datasetDisplayName,
  tooltip = undefined,
}: {
  datasetUrl: string | null;
  datasetDisplayName: string;
  tooltip?: string;
}) => (
  <>
    <a href={datasetUrl || ""}>{datasetDisplayName}</a>
    {tooltip && (
      <InfoIcon
        target={customInfoImg}
        popoverContent={<p>{tooltip}</p>}
        popoverId={`data-availability-tooltip-${datasetDisplayName}`}
        trigger={["hover", "focus"]}
      />
    )}
  </>
);

export const DatasetAvailabilityTile: React.FC<DatasetAvailabilityTileProps> = ({
  compoundId,
  compoundName,
  datasets,
}) => {
  const {
    dataAvailabilityData,
    error,
    isLoading,
  } = useDataAvailabilityTileData(compoundId, datasets);

  const [isExpanded, setIsExpanded] = useState(false);

  if (!isLoading && error) {
    return <ErrorLoading tileName={`Datasets with data for ${compoundName}`} />;
  }

  if (
    !isLoading &&
    (!dataAvailabilityData || dataAvailabilityData.length === 0)
  ) {
    return null;
  }

  const initialData = dataAvailabilityData.slice(0, 5);
  const extraData = dataAvailabilityData.slice(5, 50);
  const hasMore = dataAvailabilityData.length > 5;

  return (
    <article
      className={`${styles.DatasetAvailabilityTile} card_wrapper stacked-boxplot-tile`}
    >
      <div className="card_border container_fluid">
        <div>
          <h2 className="no_margin cardtitle_text">
            Datasets with data for {compoundName}
          </h2>
        </div>

        <div
          className="card_padding"
          style={{ overflowX: "auto", width: "100%" }}
        >
          {isLoading && <PlotSpinner />}
          {!isLoading && (
            <table className={styles.infoTable}>
              <thead>
                <tr>
                  <th className={styles.datasetColth}>Dataset</th>
                  <th className={styles.cellLinesColth}>Cell Lines</th>
                  <th className={styles.doseRangeColth}>Dose Range</th>
                  <th className={styles.assayColth}>Assay</th>
                </tr>
              </thead>
              <tbody>
                {initialData.map((entry, index: number) => (
                  <tr key={index}>
                    <td className={styles.datasetColContent}>
                      <DatasetName
                        datasetUrl={entry.datasetUrl}
                        datasetDisplayName={entry.datasetDisplayName}
                        tooltip={entry.tooltip}
                      />
                    </td>
                    <td className={styles.cellLineColContent}>
                      {entry.cellLineCount}
                    </td>
                    <td className={styles.doseRangeLabelColContent}>
                      {entry.doseRangeLabel}
                    </td>
                    <td className={styles.assayLabelColContent}>
                      {entry.assayLabel}
                    </td>
                  </tr>
                ))}

                {isExpanded &&
                  extraData.map((entry, index) => (
                    <tr key={index + 5}>
                      <td className={styles.extraDataContainer}>
                        <DatasetName
                          datasetUrl={entry.datasetUrl}
                          datasetDisplayName={entry.datasetDisplayName}
                          tooltip={entry.tooltip}
                        />
                      </td>
                      <td>{entry.cellLineCount}</td>
                      <td>{entry.doseRangeLabel}</td>
                      <td>{entry.assayLabel}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {!isLoading && hasMore && (
            <div className={styles.viewMoreLessContainer}>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={styles.buttonLink}
              >
                {isExpanded ? "View Less" : "View More"}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export default DatasetAvailabilityTile;
