import React from "react";
import { Tooltip, OverlayTrigger } from "react-bootstrap";
import { toStaticUrl } from "@depmap/globals";
import RectanglePlot from "src/cellLine/components/RectanglePlot";
import { DepmapApi } from "src/dAPI";
import { CellLineDataMatrix } from "../models/types";

export interface PrefDepProps {
  depmapId: string;
  crisprData: CellLineDataMatrix;
  rnaiData: CellLineDataMatrix;
  dapi: DepmapApi;
}

const PrefDepTile = ({
  depmapId,
  crisprData,
  rnaiData,
  dapi,
}: PrefDepProps) => {
  const prefDepTooltip = (
    <Tooltip>
      The below genes are ranked by z-score. The z-score is computed for each
      gene by taking the gene effect for this model, subtracting the mean across
      all models, and dividing by the standard deviation.
    </Tooltip>
  );

  if (crisprData.data || rnaiData.data) {
    return (
      <article className="card_wrapper stacked-boxplot-tile">
        <div className="card_border container_fluid">
          <h2 className="no_margin cardtitle_text">
            Top 10 Preferentially Essential Genes
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
            {crisprData.data && (
              <>
                <h3>CRISPR</h3>
                <h4>{crisprData.dataset_label}</h4>
                <RectanglePlot
                  svgName="stacked-boxplot-react-svg-crispr"
                  scoresMatrix={crisprData.data}
                  labels={crisprData.labels}
                  cellLineColIndex={crisprData.cell_line_col_index}
                  xAxisLabel="Gene Effect"
                  linkType="gene"
                />
              </>
            )}

            {rnaiData.data && (
              <>
                <h3>RNAi</h3>
                <h4>{rnaiData.dataset_label}</h4>
                <RectanglePlot
                  svgName="stacked-boxplot-react-svg-rnai"
                  scoresMatrix={rnaiData.data}
                  labels={rnaiData.labels}
                  cellLineColIndex={rnaiData.cell_line_col_index}
                  xAxisLabel="Gene Effect"
                  linkType="gene"
                />
              </>
            )}
            <p className="stacked-boxplot-download-container">
              Download gene effect z-scores for all genes:
              {crisprData.data && (
                <a
                  href={dapi._getFileUrl(
                    `/cell_line/gene_effects/download/crispr/${depmapId}`
                  )}
                >
                  {" "}
                  CRISPR
                </a>
              )}
              {crisprData.data && rnaiData.data && <span>,</span>}
              {rnaiData.data && (
                <a
                  href={dapi._getFileUrl(
                    `/cell_line/gene_effects/download/rnai/${depmapId}`
                  )}
                >
                  {" "}
                  RNAi
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

export default PrefDepTile;
