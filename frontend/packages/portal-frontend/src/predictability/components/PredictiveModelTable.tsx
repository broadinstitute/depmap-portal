import React from "react";
import { DepmapApi } from "src/dAPI";

import { toStaticUrl } from "@depmap/globals";
import InfoIcon from "src/common/components/InfoIcon";
import StyledMeter from "src/common/components/StyledMeter";
import { EntityType } from "src/entity/models/entities";
import CorrelationMeter from "src/predictability/components/CorrelationMeter";
import {
  PredictiveFeatureResult,
  ScreenType,
} from "src/predictability/models/predictive";

const FEATURE_IMPORTANCE_DESCRIPTION = (
  <span>
    Indicates the impact of an individual feature on prediction accuracy
    relative to the other features available to the model (0 to 100% scale). It
    is calculated using Gini Importance and is normalized so the total of all
    feature importance is 100%.{" "}
    <a
      href="https://scikit-learn.org/stable/"
      target="_blank"
      rel="noreferrer noopener"
    >
      See sklearn for details
    </a>
    .
  </span>
);

const FEATURE_TYPE_DESCRIPTION = (
  <table>
    <thead className="visually-hidden">
      <tr>
        <th>Feature type</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Expression</td>
        <td>mRNA expression</td>
      </tr>
      <tr>
        <td>Dam. Mut.</td>
        <td>Damaging mutations</td>
      </tr>
      <tr>
        <td>Driver Mut.</td>
        <td>Driver mutations</td>
      </tr>
      <tr>
        <td>Hot. Mut.</td>
        <td>Hotspot mutations</td>
      </tr>
      <tr>
        <td>Lineage</td>
        <td>Lineage annotation</td>
      </tr>
      <tr>
        <td>RPPA</td>
        <td>Protein level (RPPA)</td>
      </tr>
      <tr>
        <td>Methylation</td>
        <td>Methylation (RRBS)</td>
      </tr>
      <tr>
        <td>Metabolomics</td>
        <td>Metabolimics</td>
      </tr>
      <tr>
        <td>Fusion</td>
        <td>Fusion</td>
      </tr>
      {/* <tr>
        <td>ssGSEA</td>
        <td>Single sample Gene Set Enrichment analysis</td>
      </tr> */}
      <tr>
        <td>Copy num.</td>
        <td>Copy number</td>
      </tr>
      <tr>
        <td>Confounders</td>
        <td>Experimental covariates</td>
      </tr>
      {/* <tr>
        <td>Proteomics</td>
        <td>Proteomics (MS)</td>
      </tr> */}
    </tbody>
  </table>
);

const getRelationshipDescription = (
  dapi: DepmapApi,
  entityType: EntityType
) => {
  return entityType === EntityType.Gene ? (
    <>
      <div style={{ display: "flex", alignItems: "center" }}>
        <img
          src={toStaticUrl("img/predictability/self.svg")}
          alt=""
          style={{ height: 12, marginInlineEnd: 4 }}
        />
        Self
      </div>
      <p>
        Features that correspond to measurements of the same gene as the
        dependency being predicted (Lin and Confounders are still included).
      </p>

      <div style={{ display: "flex", alignItems: "center" }}>
        <img
          src={toStaticUrl("img/predictability/related.svg")}
          alt=""
          style={{ height: 12, marginInlineEnd: 4 }}
        />
        Related
      </div>
      <p>
        Features that are connected to the target gene dependency by PPI
        (inweb), members of the same protein complex (CORUM), or paralogs based
        on DNA sequence analysis from Ensembl (Lin and Confounders are still
        included).
      </p>
    </>
  ) : (
    <>
      <div style={{ display: "flex", alignItems: "center" }}>
        <img
          src={toStaticUrl("img/predictability/target.svg")}
          alt=""
          style={{ height: 12, marginInlineEnd: 4 }}
        />
        Target
      </div>
      <p>
        Annotated drug target in{" "}
        <a
          href="https://clue.io/repurposing-app"
          target="_blank"
          rel="noreferrer noopener"
        >
          Repurposing hub
        </a>
      </p>
    </>
  );
};

interface Props {
  dapi: DepmapApi;
  entityType: EntityType;
  screenType: ScreenType;
  modelName: string;
  modelCorrelation: number;
  results: Array<PredictiveFeatureResult>;
  modelFeatureSets?: string;
  defaultOpen?: boolean;
}

const PredictiveModelTable = ({
  dapi,
  entityType,
  screenType,
  modelName,
  modelCorrelation,
  results,
  modelFeatureSets = undefined,
  defaultOpen = false,
}: Props) => {
  return (
    <details className="model-results-accordion" open={defaultOpen}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <summary
        onClick={(e) => {
          if ((e.target as HTMLElement).className.includes("icon")) {
            e.preventDefault();
          }
        }}
      >
        <div className="predictive-model-summary-container">
          <span className={`predictive-model-name-info`}>
            <span className="predictive-model-name">{modelName}</span>
            {modelFeatureSets && (
              <InfoIcon
                popoverId={`predictive-model-info-${modelName}`}
                popoverContent={
                  <>
                    <div style={{ fontWeight: "bold" }}>Feature Sets</div>
                    <div>{modelFeatureSets}</div>
                  </>
                }
                trigger="click"
              />
            )}
          </span>
          <span className="predictive-model-correlation-container">
            <StyledMeter
              value={modelCorrelation}
              extraClassNames={`predictive-model-correlation-box ${screenType}`}
            />
            <div className="model-correlation-text">
              {modelCorrelation?.toPrecision(3)}
            </div>
          </span>
        </div>
      </summary>
      <div className="predictive-results-table-container">
        <table className="predictive-results-table">
          <thead>
            <tr>
              <th aria-label="Relationship">
                <span className="column-header">
                  <InfoIcon
                    popoverContent={getRelationshipDescription(
                      dapi,
                      entityType
                    )}
                    popoverId={`relationship-popover-${screenType}-${modelName}`}
                    trigger="click"
                  />
                </span>
              </th>
              <th>Feature</th>
              <th>
                <span className="column-header">
                  <span>Relative Importance</span>
                  <InfoIcon
                    popoverContent={FEATURE_IMPORTANCE_DESCRIPTION}
                    popoverId={`feature-importance-popover-${screenType}-${modelName}`}
                    trigger="click"
                  />
                </span>
              </th>
              <th>Correlation</th>
              <th>
                <span className="column-header">
                  <span>Feature Type</span>
                  <InfoIcon
                    popoverContent={FEATURE_TYPE_DESCRIPTION}
                    popoverId={`feature-type-popover-${screenType}-${modelName}`}
                    trigger="click"
                    placement="left"
                    className="popover-with-table"
                  />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => {
              const {
                featureName,
                featureImportance,
                correlation,
                featureType,
                relatedType,
                interactiveUrl,
              } = result;

              return (
                <tr key={`${featureType}-${featureName}`}>
                  <td>
                    {relatedType && (
                      <span className="related-icon-container">
                        <img
                          src={toStaticUrl(
                            `img/predictability/${relatedType}.svg`
                          )}
                          alt={relatedType}
                        />
                      </span>
                    )}
                  </td>
                  <td className="feature-name">
                    {interactiveUrl ? (
                      <a href={interactiveUrl} target="_blank" rel="noreferrer">
                        {featureName}
                      </a>
                    ) : (
                      featureName
                    )}
                  </td>
                  <td>
                    <StyledMeter
                      value={featureImportance}
                      extraClassNames={`predictive-feature-result-importance ${screenType}`}
                      toFixed={1}
                      percentage
                      showLabel
                    />
                  </td>
                  <td>
                    {correlation && (
                      <CorrelationMeter correlation={correlation} />
                    )}
                  </td>
                  <td>{featureType}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
};

export default PredictiveModelTable;
