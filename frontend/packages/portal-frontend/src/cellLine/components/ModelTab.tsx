import React from "react";
import { ModelInfo } from "../models/types";
import styles from "../styles/CellLinePage.scss";

export interface ModelTabProps {
  modelInfo: ModelInfo;
}

const ModelTab = ({ modelInfo }: ModelTabProps) => {
  const urlPrefix = `${window.location.protocol}//${window.location.host}`;

  const showOverview =
    modelInfo.oncotree_subtype_and_code ||
    modelInfo.oncotree_primary_disease ||
    modelInfo.oncotree_lineage ||
    modelInfo.legacy_molecular_subtype ||
    modelInfo.primary_metastasis ||
    modelInfo.sample_collection_site ||
    modelInfo.image;

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
          {showOverview && (
            <h4 className={styles.propertyGroupHeader}>Overview</h4>
          )}
          {modelInfo.oncotree_subtype_and_code && (
            <>
              <h6 className={styles.propertyHeader}>
                Oncotree Subtype and Code
              </h6>
              {modelInfo.oncotree_subtype_and_code.url ? (
                <a
                  className={styles.descriptionLinks}
                  href={`${urlPrefix}${modelInfo.oncotree_subtype_and_code.url}`}
                >
                  {modelInfo.oncotree_subtype_and_code.display_name}
                </a>
              ) : (
                <p>{modelInfo.oncotree_subtype_and_code.display_name}</p>
              )}
            </>
          )}
          {modelInfo.oncotree_primary_disease && (
            <>
              <h6 className={styles.propertyHeader}>
                Oncotree Primary Disease
              </h6>
              {modelInfo.oncotree_primary_disease.url ? (
                <a
                  className={styles.descriptionLinks}
                  href={`${urlPrefix}${modelInfo.oncotree_primary_disease.url}`}
                >
                  {modelInfo.oncotree_primary_disease.display_name}
                </a>
              ) : (
                <p>{modelInfo.oncotree_primary_disease.display_name}</p>
              )}
            </>
          )}
          {modelInfo.oncotree_lineage && (
            <>
              <h6 className={styles.propertyHeader}>Oncotree Lineage</h6>
              {modelInfo.oncotree_lineage.url ? (
                <a
                  className={styles.descriptionLinks}
                  href={`${urlPrefix}${modelInfo.oncotree_lineage.url}`}
                >
                  {modelInfo.oncotree_lineage.display_name}
                </a>
              ) : (
                <p>{modelInfo.oncotree_lineage.display_name}</p>
              )}
            </>
          )}
          {modelInfo.legacy_molecular_subtype && (
            <>
              <h6 className={styles.propertyHeader}>Molecular Subtype</h6>
              <p>{modelInfo.legacy_molecular_subtype}</p>
            </>
          )}
          {modelInfo.primary_metastasis && (
            <>
              <h6 className={styles.propertyHeader}>Primary/Metastasis</h6>
              <p>{modelInfo.primary_metastasis}</p>
            </>
          )}
          {modelInfo.sample_collection_site && (
            <>
              <h6 className={styles.propertyHeader}>Collection Site</h6>
              <p>{modelInfo.sample_collection_site}</p>
            </>
          )}
          {modelInfo.image && (
            <img
              className={styles.cellLineImage}
              src={modelInfo.image}
              alt="cell line"
            />
          )}
        </div>
        <div className={styles.descriptionTileColumn}>
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
          {modelInfo.source_type && (
            <>
              <h6 className={styles.propertyHeader}>Source</h6>
              <p>{modelInfo.source_type}</p>
            </>
          )}
          {modelInfo.tissue_origin && (
            <>
              <h6 className={styles.propertyHeader}>Tissue Origin</h6>
              <p>{modelInfo.tissue_origin}</p>
            </>
          )}
          {modelInfo.catalog_number && (
            <>
              <h6 className={styles.propertyHeader}>Catalog Number</h6>
              <p>{modelInfo.catalog_number}</p>
            </>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default ModelTab;
