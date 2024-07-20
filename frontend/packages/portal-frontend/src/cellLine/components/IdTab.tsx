import React from "react";
import { IdInfo } from "../models/types";
import styles from "../styles/CellLinePage.scss";

export interface IdTabProps {
  idInfo: IdInfo;
}

const IdTab = ({ idInfo }: IdTabProps) => {
  const aliases = idInfo.aliases;
  if (idInfo) {
    return (
      <div className={styles.descriptionTileColumns}>
        <div className={styles.descriptionTileColumn}>
          {idInfo.ccle_name && (
            <>
              <h4>CCLE Name</h4>
              <p>{idInfo.ccle_name}</p>
            </>
          )}
          {aliases && aliases.length > 0 && (
            <span>
              <h4>Aliases: </h4>
              {aliases.map((alias, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <span key={index}>
                  <p>{alias}</p>
                  {index < aliases.length - 1 ? ", " : ""}
                </span>
              ))}
            </span>
          )}
          {idInfo.rrid && (
            <>
              <h4>Cellosaurus RRID</h4>
              <a
                className={styles.descriptionLinks}
                href={`http://web.expasy.org/cellosaurus/${idInfo.rrid}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {idInfo.rrid}
              </a>
            </>
          )}
          {idInfo.sanger_model_id && (
            <>
              <h4>Sanger Model ID</h4>
              <a
                className={styles.descriptionLinks}
                href={`https://cellmodelpassports.sanger.ac.uk/passports/${idInfo.sanger_model_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {idInfo.sanger_model_id}
              </a>
            </>
          )}
          {idInfo.cosmic_id && (
            <>
              <h4>COSMIC ID</h4>
              <a
                className={styles.descriptionLinks}
                href={`https://cancer.sanger.ac.uk/cell_lines/sample/overview?id=${idInfo.cosmic_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {idInfo.cosmic_id}
              </a>
            </>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default IdTab;
