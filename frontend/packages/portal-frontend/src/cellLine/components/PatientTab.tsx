import React from "react";
import { ModelAnnotation } from "../models/ModelAnnotation";
import styles from "../styles/CellLinePage.scss";

export interface PatientTabProps {
  patientInfo: ModelAnnotation;
  relatedModels: {
    model_id: string;
    url: string;
  }[];
}

const PatientTab = ({ patientInfo, relatedModels }: PatientTabProps) => {
  const showOverview =
    patientInfo.Age ||
    patientInfo.AgeCategory ||
    patientInfo.Sex ||
    patientInfo.PatientRace;

  const showDiagnosisAndTreatment =
    patientInfo.PatientSubtypeFeatures ||
    patientInfo.PatientTreatmentStatus ||
    patientInfo.PatientTreatmentDetails;

  const showRelatedModels = relatedModels.length > 0;

  if (patientInfo) {
    return (
      <div className={styles.descriptionTileColumns}>
        <div className={styles.descriptionTileColumn}>
          {showOverview && (
            <h4 className={styles.propertyGroupHeader}>Overview</h4>
          )}
          {(patientInfo.Age || patientInfo.AgeCategory) && (
            <>
              <h6 className={styles.propertyHeader}>Age and Category</h6>
              <p>
                {patientInfo.Age && <span>{patientInfo.Age}</span>}
                {patientInfo.Age && patientInfo.AgeCategory && <span>, </span>}
                {patientInfo.AgeCategory && (
                  <span>{patientInfo.AgeCategory}</span>
                )}
              </p>
            </>
          )}
          {patientInfo.Sex && (
            <>
              <h6 className={styles.propertyHeader}>Sex</h6>
              <p>{patientInfo.Sex}</p>
            </>
          )}
          {patientInfo.PatientRace && (
            <>
              <h6 className={styles.propertyHeader}>Race</h6>
              <p>{patientInfo.PatientRace}</p>
            </>
          )}
          <br />
          {showDiagnosisAndTreatment && (
            <h4 className={styles.propertyGroupHeader}>
              Diagnosis and Treatment
            </h4>
          )}
          {patientInfo.PatientSubtypeFeatures && (
            <>
              <h6 className={styles.propertyHeader}>
                Patient Molecular Subtype
              </h6>
              <p>{patientInfo.PatientSubtypeFeatures}</p>
            </>
          )}
          {patientInfo.PatientTreatmentStatus && (
            <>
              <h6 className={styles.propertyHeader}>Treatment Status</h6>
              <p>{patientInfo.PatientTreatmentStatus}</p>
            </>
          )}
          {patientInfo.PatientTreatmentDetails && (
            <>
              <h6 className={styles.propertyHeader}>Treatment Details</h6>
              <p>{patientInfo.PatientTreatmentDetails}</p>
            </>
          )}
        </div>
        <div className={styles.descriptionTileColumn}>
          {showRelatedModels && (
            <span>
              <h4 className={styles.propertyGroupHeader}>Related Models</h4>
              {relatedModels.map((model) => (
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
