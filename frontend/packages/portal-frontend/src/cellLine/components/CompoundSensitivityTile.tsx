import React from "react";
import { Tooltip, OverlayTrigger } from "react-bootstrap";
import { toStaticUrl } from "@depmap/globals";
import RectanglePlot from "src/cellLine/components/RectanglePlot";
import { DepmapApi } from "src/dAPI";
import { CellLineDataMatrix } from "../models/types";

export interface CompoundSensitivityTileProps {
  depmapId: string;
  dataMatrix: CellLineDataMatrix;
  dapi: DepmapApi;
}

const CompoundSensitivityTile = ({
  depmapId,
  dataMatrix,
  dapi,
}: CompoundSensitivityTileProps) => {
  const prefDepTooltip = (
    <Tooltip>
      The below compounds are ranked by z-score. The z-score is computed for
      each gene by taking the gene effect for this model, subtracting the mean
      across all models, and dividing by the standard deviation.
    </Tooltip>
  );

  if (dataMatrix.data) {
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
          <div className="card_padding stacked-boxplot-graphs-padding">
            <h4>{dataMatrix.dataset_label}</h4>
            {dataMatrix.data && (
              <RectanglePlot
                svgName="compound-sensitivity-svg"
                scoresMatrix={dataMatrix.data}
                labels={dataMatrix.labels}
                cellLineColIndex={dataMatrix.cell_line_col_index}
                xAxisLabel="Compound Sensitivity"
                linkType="compound"
              />
            )}
            <p className="stacked-boxplot-download-container">
              {dataMatrix.data && (
                <a
                  href={dapi._getFileUrl(
                    `/cell_line/compound_sensitivity/download/${depmapId}`
                  )}
                >
                  Download compound sensitivity z-scores for all compounds
                </a>
              )}
            </p>
          </div>
        </div>
      </article>
    );
  }
  return null;
};

export default CompoundSensitivityTile;
