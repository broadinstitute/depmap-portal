import React from "react";
import { ModelInfo, SubtypeTreeInfo } from "../models/types";
import styles from "../styles/CellLinePage.scss";

export interface ModelTabProps {
  modelInfo: ModelInfo;
}

const ModelTab = ({ modelInfo }: ModelTabProps) => {
  const showAnnotations =
    modelInfo.oncotree_lineage ||
    modelInfo.oncotree_primary_disease ||
    modelInfo.oncotree_subtype_and_code;

  const showDerivation =
    modelInfo.growth_pattern ||
    modelInfo.model_derivation_material ||
    modelInfo.engineered_model;

  const showSourceInformation =
    modelInfo.source_type ||
    modelInfo.tissue_origin ||
    modelInfo.catalog_number;

  if (modelInfo) {
    return (
      <div className={styles.descriptionTileColumns}>
        <div className={styles.descriptionTileColumn}>
          {showAnnotations && (
            <h4 className={styles.propertyGroupHeader}>Annotations</h4>
          )}
          {modelInfo.oncotree_subtype_and_code && (
            <>
              <h6 className={styles.propertyHeader}>
                Oncotree Subtype and Code
              </h6>
              <p>{modelInfo.oncotree_subtype_and_code}</p>
            </>
          )}
          {modelInfo.oncotree_primary_disease && (
            <>
              <h6 className={styles.propertyHeader}>
                Oncotree Primary Disease
              </h6>
              <p>{modelInfo.oncotree_primary_disease}</p>
            </>
          )}
          {modelInfo.oncotree_lineage && (
            <>
              <h6 className={styles.propertyHeader}>Oncotree Lineage</h6>
              <p>{modelInfo.oncotree_lineage}</p>
            </>
          )}
          {modelInfo.lineage_tree && modelInfo.lineage_tree.length > 0 && (
            <>
              <h4 className={styles.propertyGroupHeader}>Lineage Contexts</h4>
              {modelInfo.lineage_tree
                .sort((a, b) => a.level - b.level)
                .map((info: SubtypeTreeInfo) => (
                  <>
                    <h6 className={styles.propertyHeader}>
                      Level {info.level}
                    </h6>
                    <a
                      className={styles.descriptionLinks}
                      href={info.context_explorer_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {info.node_name} ({info.subtype_code})
                    </a>
                  </>
                ))}
            </>
          )}
        </div>
        <div className={styles.descriptionTileColumn}>
          {modelInfo.molecular_subtype_tree &&
            modelInfo.molecular_subtype_tree.length > 0 && (
              <>
                <h4 className={styles.propertyGroupHeader}>
                  Molecular Subtypes
                </h4>
                {modelInfo.molecular_subtype_tree
                  .sort((a, b) => a.level - b.level)
                  .map((info: SubtypeTreeInfo) => (
                    <>
                      <h6 className={styles.propertyHeader}>
                        Level {info.level}
                      </h6>
                      <a
                        className={styles.descriptionLinks}
                        href={info.context_explorer_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {info.node_name} ({info.subtype_code})
                      </a>
                    </>
                  ))}
              </>
            )}
          {modelInfo.metadata.PrimaryOrMetastasis && (
            <>
              <h6 className={styles.propertyHeader}>Primary/Metastasis</h6>
              <p>{modelInfo.metadata.PrimaryOrMetastasis}</p>
            </>
          )}
          {modelInfo.metadata.SampleCollectionSite && (
            <>
              <h6 className={styles.propertyHeader}>Collection Site</h6>
              <p>{modelInfo.metadata.SampleCollectionSite}</p>
            </>
          )}
          {modelInfo.image && (
            <img
              className={styles.cellLineImage}
              src={modelInfo.image}
              alt="cell line"
            />
          )}
          {showDerivation && (
            <h4 className={styles.propertyGroupHeader}>Derivation</h4>
          )}
          {modelInfo.growth_pattern && (
            <>
              <h6 className={styles.propertyHeader}>Derivation Method</h6>
              <p>{modelInfo.growth_pattern}</p>
            </>
          )}
          {modelInfo.model_derivation_material && (
            <>
              <h6 className={styles.propertyHeader}>Drivation Source</h6>
              <p>{modelInfo.model_derivation_material}</p>
            </>
          )}
          {modelInfo.engineered_model && (
            <>
              <h6 className={styles.propertyHeader}>Engineered Model</h6>
              <p>{modelInfo.engineered_model}</p>
            </>
          )}
          <br />
          {showSourceInformation && (
            <h4 className={styles.propertyGroupHeader}>Source Information</h4>
          )}
          {modelInfo.metadata.SourceType && (
            <>
              <h6 className={styles.propertyHeader}>Source</h6>
              <p>{modelInfo.metadata.SourceType}</p>
            </>
          )}
          {modelInfo.metadata.TissueOrigin && (
            <>
              <h6 className={styles.propertyHeader}>Tissue Origin</h6>
              <p>{modelInfo.tissue_origin}</p>
            </>
          )}
          {modelInfo.metadata.CatalogNumber && (
            <>
              <h6 className={styles.propertyHeader}>Catalog Number</h6>
              <p>{modelInfo.metadata.CatalogNumber}</p>
            </>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default ModelTab;
