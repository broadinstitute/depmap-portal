import React from "react";
import { ModelAnnotation } from "../models/ModelAnnotation";
import styles from "../styles/CellLinePage.scss";

export interface IdTabProps {
  idInfo: ModelAnnotation;
  aliases: string[];
}

const IdTab = ({ idInfo, aliases }: IdTabProps) => {
  if (idInfo) {
    return (
      <div className={styles.descriptionTileColumns}>
        <div className={styles.descriptionTileColumn}>
          {idInfo.CellLineName && (
            <>
              <h4>Cell Line Name</h4>
              <p>{idInfo.CCLEName}</p>
            </>
          )}
          {idInfo.CCLEName && (
            <>
              <h4>CCLE Name</h4>
              <p>{idInfo.CCLEName}</p>
            </>
          )}

          {aliases && aliases.length > 0 && (
            <span>
              <h4>Aliases: </h4>
              <p>
                {aliases.map((alias, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <span key={index}>
                    {alias}
                    {index < aliases.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            </span>
          )}
          {idInfo.RRID && (
            <>
              <h4>Cellosaurus RRID</h4>
              <a
                className={styles.descriptionLinks}
                href={`http://web.expasy.org/cellosaurus/${idInfo.RRID}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {idInfo.RRID}
              </a>
            </>
          )}
          {idInfo.SangerModelID && (
            <>
              <h4>Sanger Model ID</h4>
              <a
                className={styles.descriptionLinks}
                href={`https://cellmodelpassports.sanger.ac.uk/passports/${idInfo.SangerModelID}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {idInfo.SangerModelID}
              </a>
            </>
          )}
          {idInfo.COSMICID && (
            <>
              <h4>COSMIC ID</h4>
              <a
                className={styles.descriptionLinks}
                href={`https://cancer.sanger.ac.uk/cell_lines/sample/overview?id=${idInfo.COSMICID}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {idInfo.COSMICID}
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
