import React from "react";
import styles from "../CompoundTiles.scss";

export const TopFeaturesTable: React.FC<{ features: any[]; type: string }> = ({
  features,
  type,
}) => (
  <div className={styles.topFeaturesTableContainer}>
    <table className={styles.topFeaturesTable}>
      <thead>
        <tr>
          <th>{""}</th>
          <th>Feature</th>
          <th>Importance</th>
          <th>Corr.</th>
          <th>Type</th>
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
            <td>
              {feature.interactive_url ? (
                <a
                  href={feature.interactive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {feature.name}
                </a>
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
