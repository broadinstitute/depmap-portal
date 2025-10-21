import React from "react";
import { toStaticUrl } from "@depmap/globals";
import InfoIcon from "src/common/components/InfoIcon";
import useStructureAndDetailData from "./hooks/useStructureAndDetailData";
import styles from "./CompoundTiles.scss";
import PlotSpinner from "src/plot/components/PlotSpinner";

interface StructureAndDetailTileProps {
  compoundId: string;
}

const getGenePageUrl = (gene: string) => {
  return window.location.href.split("compound")[0].concat(`gene/${gene}`);
};

export const StructureAndDetailTile: React.FC<StructureAndDetailTileProps> = ({
  compoundId,
}) => {
  const {
    metadata,
    structureImageUrl,
    error,
    isLoading,
  } = useStructureAndDetailData(compoundId);

  // TODO: Always show InfoIcon once we have content for the popoverContent
  const showInfoIcon = false;
  const customInfoImg = (
    <img
      src={toStaticUrl("img/gene_overview/info_purple.svg")}
      alt="structure and detail info tip"
      className={styles.infoImage}
    />
  );

  if (!isLoading && error) {
    return (
      <article
        className={`${styles.StructureAndDetailTile} card_wrapper stacked-boxplot-tile`}
      >
        <div className="card_border container_fluid">
          <h2 className="no_margin cardtitle_text">Structure and Details </h2>
          <div className="card_padding">
            <div className={styles.errorMessage}>
              There was an error loading this tile.
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`${styles.StructureAndDetailTile} card_wrapper stacked-boxplot-tile`}
    >
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">
          Structure and Details{" "}
          {showInfoIcon && (
            <InfoIcon
              target={customInfoImg}
              popoverContent={<p>{"This is a tooltip"}</p>}
              popoverId={`struc-detail-popover`}
              trigger={["hover", "focus"]}
            />
          )}
        </h2>
        {isLoading && !error && <PlotSpinner />}
        {metadata && (
          <div className="card_padding">
            {structureImageUrl && (
              <div>
                <img
                  className="image_width_100"
                  src={structureImageUrl}
                  alt="compound structure"
                />
              </div>
            )}
            {metadata.PubChemCID[compoundId] && (
              <div className={styles.metadataLine}>
                <div className={styles.metadataLineLabel}>PubChem ID: </div>
                <a
                  href={`https://pubchem.ncbi.nlm.nih.gov/compound/${metadata.PubChemCID[compoundId]}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {metadata.PubChemCID[compoundId]}
                </a>
              </div>
            )}
            {metadata.ChEMBLID[compoundId] && (
              <div className={styles.metadataLine}>
                <div className={styles.metadataLineLabel}>ChEMBL ID: </div>
                <a
                  href={`https://www.ebi.ac.uk/chembl/compound_report_card/${metadata.ChEMBLID[compoundId]}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {metadata.ChEMBLID[compoundId]}
                </a>
              </div>
            )}
            {metadata.SMILES[compoundId] && (
              <div className={styles.metadataLine}>
                <div className={styles.metadataLineLabel}>SMILES:</div>
                <a
                  href={`https://pubchem.ncbi.nlm.nih.gov/compound/${metadata.PubChemCID[compoundId]}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {metadata.SMILES[compoundId]}
                </a>
              </div>
            )}
            {metadata.TargetOrMechanism[compoundId] && (
              <div className={styles.metadataLine}>
                <div className={styles.metadataLineLabel}>
                  Target/Mechanism:
                </div>
                {metadata.TargetOrMechanism[compoundId]}
              </div>
            )}
            {metadata.GeneSymbolOfTargets[compoundId] &&
              metadata.GeneSymbolOfTargets[compoundId].length > 0 && (
                <div className={styles.metadataLine}>
                  <h4 className={styles.metadataLineLabel}>Target: </h4>
                  {metadata.GeneSymbolOfTargets[compoundId].map(
                    (gene: string, i: number) =>
                      i <
                      metadata.GeneSymbolOfTargets[compoundId]!.length - 1 ? (
                        <a
                          href={getGenePageUrl(gene)}
                          target="_blank"
                          rel="noreferrer"
                          key={i}
                        >
                          {gene},
                        </a>
                      ) : (
                        <a
                          href={getGenePageUrl(gene)}
                          target="_blank"
                          rel="noreferrer"
                          key={i}
                        >
                          {gene}
                        </a>
                      )
                  )}
                </div>
              )}
          </div>
        )}
      </div>
    </article>
  );
};
