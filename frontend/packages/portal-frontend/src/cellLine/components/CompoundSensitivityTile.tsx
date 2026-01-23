import React from "react";
import { Tooltip, OverlayTrigger } from "react-bootstrap";
import { toPortalLink, toStaticUrl } from "@depmap/globals";
import { CellLineDataMatrix } from "@depmap/types";
import RectanglePlot from "src/cellLine/components/RectanglePlot";

export interface CompoundSensitivityTileProps {
  depmapId: string;
  dataMatrices: CellLineDataMatrix[];
}

const CompoundSensitivityTile = ({
  depmapId,
  dataMatrices,
}: CompoundSensitivityTileProps) => {
  const prefDepTooltip = (
    <Tooltip id="compound-sensitivity-tooltip">
      The below compounds are ranked by z-score. The z-score is computed for
      each gene by taking the gene effect for this model, subtracting the mean
      across all models, and dividing by the standard deviation.
    </Tooltip>
  );

  // If there are no matrices or none of them have data, return null
  if (dataMatrices.length === 0 || !dataMatrices.some((dm) => dm.data)) {
    return null;
  }

  return (
    <article className="card_wrapper stacked-boxplot-tile">
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">
          Top 10 Preferential Compound Sensitivities
          <span className="stacked-boxplot-tooltip">
            <OverlayTrigger placement="bottom" overlay={prefDepTooltip}>
              <img
                src={toStaticUrl("img/predictability/info.svg")}
                alt="info icon"
              />
            </OverlayTrigger>
          </span>
        </h2>

        {dataMatrices.map((dataMatrix, index) => {
          // Skip rendering if this specific matrix has no data
          if (!dataMatrix.data) {
            return null;
          }

          return (
            <div
              key={`${dataMatrix.dataset_label}-${index}`}
              className="card_padding stacked-boxplot-graphs-padding"
            >
              <h4>{dataMatrix.dataset_label}</h4>
              <RectanglePlot
                svgName={`compound-sensitivity-svg-${index}`}
                scoresMatrix={dataMatrix.data}
                labels={dataMatrix.labels}
                cellLineColIndex={dataMatrix.cell_line_col_index}
                xAxisLabel="Compound Sensitivity"
                linkType="compound"
              />
              <p className="stacked-boxplot-download-container">
                Download z-scores for all compounds:{" "}
                <a
                  href={toPortalLink(
                    `/cell_line/compound_sensitivity/download/${depmapId}?dataset=${dataMatrix.dataset_label}`
                  )}
                >
                  {dataMatrix.dataset_label}
                </a>
              </p>
            </div>
          );
        })}
      </div>
    </article>
  );
};

export default CompoundSensitivityTile;
