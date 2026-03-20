import React from "react";
import styles from "../CompoundTiles.scss";
import { Tooltip } from "@depmap/common-components";

export const TopFeaturesTable: React.FC<{ features: any[]; type: string }> = ({
  features,
  type,
}) => (
  <div className={styles.topFeaturesTableContainer}>
    <table className={styles.topFeaturesTable}>
      <thead>
        <tr>
          <th style={{ width: "8%" }}>{""}</th>
          <th style={{ width: "35%" }}>Feature</th>
          <th style={{ width: "25%" }}>Importance</th>
          <th style={{ width: "12%" }}>Corr.</th>
          <th style={{ width: "20%" }}>Type</th>
        </tr>
      </thead>
      <tbody>
        {features.map((feature, index) => (
          <tr key={index}>
            <td>
              {feature.related_type && (
                <span>
                  <img
                    src={`/static/img/predictability/${feature.related_type}.svg`}
                    alt=""
                  />
                </span>
              )}
            </td>
            <td className={styles.ellipsisStyle}>
              {feature.interactive_url ? (
                <Tooltip
                  id={`predictability-${feature.name}-tooltip`}
                  content={feature.name}
                  placement="top"
                >
                  <a
                    href={feature.interactive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {feature.name}
                  </a>
                </Tooltip>
              ) : (
                feature.name
              )}
            </td>
            <td>
              <div
                style={{ width: `${feature.importance * 100}%` }}
                className={`${type}_background`}
              >
                {(feature.importance * 100).toFixed(1)}%
              </div>
            </td>
            <td>
              {feature.correlation > 0 && (
                <i className="fas fa-plus" aria-label="positive" />
              )}
              {feature.correlation < 0 && (
                <i className="fas fa-minus" aria-label="negative" />
              )}
            </td>
            <td>{feature.type}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
