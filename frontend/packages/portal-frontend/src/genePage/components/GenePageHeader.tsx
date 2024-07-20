import React from "react";
import styles from "../styles/GenePage.scss";

interface Props {
  fullName: string | undefined;
  symbol: string | undefined;
  ensemblId: string | undefined;
  entrezId: string | undefined;
  hgncId: string | undefined;
  aka: string | undefined;
}

const GenePageHeader = ({
  fullName,
  symbol,
  ensemblId,
  entrezId,
  hgncId,
  aka,
}: Props): JSX.Element => {
  return (
    <div className={styles.header}>
      <div className={styles.symbol}>{symbol}</div>
      <div className={styles.fullName}>{fullName}</div>
      <div className={styles.headerInfoContainer}>
        <div className={styles.otherInfo}>
          Location:{" "}
          <span className={styles.infoContent}>
            <span className="entrez-location">{}</span>
          </span>
        </div>
        <div className={styles.headerInfoContainer}>
          {aka && (
            <div className={styles.otherInfo}>
              Also known as: <span className={styles.infoContent}>{aka}</span>
            </div>
          )}
          {hgncId && (
            <div className={styles.otherInfo}>
              HGNC:{" "}
              <span className={styles.infoContent}>
                <a
                  href={`https://www.genenames.org/cgi-bin/gene_symbol_report?hgnc_id=${hgncId}&submit=Submit`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {hgncId}
                </a>
              </span>
            </div>
          )}
          {ensemblId && (
            <div className={styles.otherInfo}>
              Ensembl:{" "}
              <span className={styles.infoContent}>
                <a
                  href={`https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${ensemblId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {ensemblId}
                </a>
              </span>
            </div>
          )}
          {entrezId && (
            <div className={styles.otherInfo}>
              NCBI Entrez Gene:{" "}
              <span className={styles.infoContent}>
                <a
                  href={`http://www.ncbi.nlm.nih.gov/gene/${entrezId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {entrezId}
                </a>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GenePageHeader;
