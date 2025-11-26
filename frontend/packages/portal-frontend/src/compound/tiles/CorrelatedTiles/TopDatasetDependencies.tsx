/* eslint-disable jsx-a11y/control-has-associated-label */
import React from "react";
import { toStaticUrl } from "@depmap/globals";
import styles from "../../styles/CorrelationTile.scss";
import { AssociatedFeatures } from "@depmap/types/src/Dataset";
import { Tooltip } from "@depmap/common-components";
import { getFullUrlPrefix } from "src/compound/utils";
import CorrelationMeter from "src/predictability/components/CorrelationMeter";

interface TopDatasetDependencyProps {
  featureId: string;
  datasetId: string;
  dataType: string;
  featureType: string;
  topDatasetCorrelations: AssociatedFeatures[];
  geneTargets: string[];
}

export const TopDatasetDependencies: React.FC<TopDatasetDependencyProps> = ({
  featureId,
  datasetId,
  dataType,
  featureType, // should be gene
  topDatasetCorrelations,
  geneTargets,
}) => {
  const urlPrefix = getFullUrlPrefix();
  return (
    <div className={styles.TopDatasetDependencies}>
      <h3 className={styles.tableDatasetTitle}>{dataType}</h3>
      <table
        style={{
          width: "100%",
          tableLayout: "fixed",
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr>
            <th style={{ width: "12%" }} />
            <th style={{ width: "10%" }} />
            <th style={{ width: "28%" }}>
              {featureType === "gene" ? "Gene" : "Compound"}
            </th>
            <th style={{ width: "18%", overflow: "visible" }}>Correlation</th>
            <th style={{ width: "32%" }}></th>
          </tr>
        </thead>
        <tbody>
          {topDatasetCorrelations.map((datasetCor, i) => {
            return (
              <tr key={`${datasetCor.other_dataset_id}-${i}`}>
                <td>
                  <a
                    href={`${urlPrefix}/data_explorer_2/?xDataset=${datasetId}&xFeature=${featureId}&yDataset=${datasetCor.other_dataset_given_id}&yFeature=${datasetCor.other_dimension_label}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Plot
                  </a>
                </td>

                <td className={styles.targetIconContainer}>
                  {geneTargets.includes(datasetCor.other_dimension_label) && (
                    <img
                      src={toStaticUrl("img/compound/target.svg")}
                      alt="Target Feature"
                    />
                  )}
                </td>
                <td className={styles.ellipsisStyle}>
                  <Tooltip
                    id="correlated-gene-tooltip"
                    content={datasetCor.other_dimension_label}
                    placement="top"
                  >
                    <a
                      href={`${urlPrefix}/${featureType}/${datasetCor.other_dimension_label}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {datasetCor.other_dimension_label}
                    </a>
                  </Tooltip>
                </td>

                <td>{datasetCor.correlation.toFixed(2)}</td>
                <td>
                  <CorrelationMeter
                    showLabel={false}
                    correlation={datasetCor.correlation}
                    customWidth={"95px"}
                    useGradedColorScheme
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
