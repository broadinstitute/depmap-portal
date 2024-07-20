import React from "react";
import { PatientInfo } from "../models/types";
import styles from "../styles/CellLinePage.scss";

export interface PatientTabProps {
  patientInfo: PatientInfo;
}

const PatientTab = ({ patientInfo }: PatientTabProps) => {
  const showOverview =
    patientInfo.age ||
    patientInfo.age_category ||
    patientInfo.sex ||
    patientInfo.race;

  const showDiagnosisAndTreatment =
    patientInfo.patient_molecular_subtype ||
    patientInfo.treatment_status ||
    patientInfo.treatment_details;

  const showRelatedModels = patientInfo.related_models.length > 0;

  if (patientInfo) {
    return (
      <div className={styles.descriptionTileColumns}>
        <div className={styles.descriptionTileColumn}>
          {showOverview && (
            <h4 className={styles.propertyGroupHeader}>Overview</h4>
          )}
          {(patientInfo.age || patientInfo.age_category) && (
            <>
              <h6 className={styles.propertyHeader}>Age and Category</h6>
              <p>
                {patientInfo.age && <span>{patientInfo.age}</span>}
                {patientInfo.age && patientInfo.age_category && <span>,</span>}
                {patientInfo.age_category && (
                  <span>{patientInfo.age_category}</span>
                )}
              </p>
            </>
          )}
          {patientInfo.sex && (
            <>
              <h6 className={styles.propertyHeader}>Sex</h6>
              <p>{patientInfo.sex}</p>
            </>
          )}
          {patientInfo.race && (
            <>
              <h6 className={styles.propertyHeader}>Race</h6>
              <p>{patientInfo.race}</p>
            </>
          )}
          <br />
          {showDiagnosisAndTreatment && (
            <h4 className={styles.propertyGroupHeader}>
              Diagnosis and Treatment
            </h4>
          )}
          {patientInfo.patient_molecular_subtype && (
            <>
              <h6 className={styles.propertyHeader}>
                Patient Molecular Subtype
              </h6>
              <p>{patientInfo.patient_molecular_subtype}</p>
            </>
          )}
          {patientInfo.treatment_status && (
            <>
              <h6 className={styles.propertyHeader}>Treatment Status</h6>
              <p>{patientInfo.treatment_status}</p>
            </>
          )}
          {patientInfo.treatment_details && (
            <>
              <h6 className={styles.propertyHeader}>Treatment Details</h6>
              <p>{patientInfo.treatment_details}</p>
            </>
          )}
        </div>
        <div className={styles.descriptionTileColumn}>
          {showRelatedModels && (
            <span>
              <h4 className={styles.propertyGroupHeader}>Related Models</h4>
              {patientInfo.related_models.map((model) => (
                <div key={model.model_id}>
                  <a className={styles.descriptionLinks} href={model.url}>
                    {model.model_id}
                  </a>
                </div>
              ))}
            </span>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default PatientTab;
