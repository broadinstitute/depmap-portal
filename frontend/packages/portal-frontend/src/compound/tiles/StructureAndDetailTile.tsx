import React from "react";
import { toStaticUrl } from "@depmap/globals";
import InfoIcon from "src/common/components/InfoIcon";
import useStructureAndDetailData from "./hooks/useStructureAndDetailData";
import styles from "./CompoundTiles.scss";

interface StructureAndDetailTileProps {
  compoundName: string;
  compoundId: string;
}

export const StructureAndDetailTile: React.FC<StructureAndDetailTileProps> = ({
  compoundName,
  compoundId,
}) => {
  const { metadata, error, isLoading } = useStructureAndDetailData(compoundId);
  const customInfoImg = (
    <img
      style={{
        height: "13px",
        margin: "1px 3px 4px 3px",
        cursor: "pointer",
      }}
      src={toStaticUrl("img/gene_overview/info_purple.svg")}
      alt="structure and detail info tip"
      className="icon"
    />
  );

  const getGenePageLinkedLabels = () => {
    // TODO left off here!!!!!
  };

  return (
    <article
      className={`${styles.StructureAndDetailTile} card_wrapper stacked-boxplot-tile`}
    >
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">
          Structure and Details{" "}
          {true && (
            <InfoIcon
              target={customInfoImg}
              popoverContent={<p>{"This is a tooltip"}</p>}
              popoverId={`struc-detail-popover`}
              trigger={["hover", "focus"]}
            />
          )}
        </h2>
        {metadata && (
          <div className="card_padding">
            {metadata.PubChemCID[compoundId] && (
              <div className={styles.metadataLine}>
                <h4 className={styles.metadataLineLabel}>PubChem ID: </h4>
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
                <h4 className={styles.metadataLineLabel}>ChEMBL ID: </h4>
                <a
                  href={`https://www.ebi.ac.uk/chembl/compound_report_card/${metadata.ChEMBLID[compoundId]}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {metadata.ChEMBLID[compoundId]}
                </a>
              </div>
            )}
            <div className={styles.metadataLine}>
              <h4 className={styles.metadataLineLabel}>SMILES: </h4>{" "}
              {metadata.SMILES[compoundId]}
            </div>
            <div className={styles.metadataLine}>
              <h4 className={styles.metadataLineLabel}>Target/Mechanism: </h4>{" "}
              {metadata.TargetOrMechanism[compoundId]}
            </div>
            {metadata.GeneSymbolOfTargets[compoundId] &&
              metadata.GeneSymbolOfTargets[compoundId].length > 0 && (
                <div className={styles.metadataLine}>
                  <h4 className={styles.metadataLineLabel}>Target: </h4>
                  {getGenePageLinkedLabels().join(",")}
                </div>
              )}
          </div>
        )}
      </div>
    </article>
  );
};
