/*
  This script was generated from ../pipeline/scripts/format_models.py via running:
    ../depmap-shared/generate-ts-from-schema.py ../pipeline/scripts/format_models.py schema ModelAnnotation ../frontend/packages/portal-frontend/src/cellLine/models/ModelAnnotation.ts
  
  Do not manually edit this file, but instead edit ../pipeline/scripts/format_models.py and
  regenerate by running "./install_prereqs.sh"
  
  The purpose of this file is to define a type which enumerates which columns are available from
  the Model.csv file for display purposes. If we add/remove columns from the Model file, we will
  detect those changes by the file won't validate against the schema. Once we've updated the 
  schema, we'll be able to detect any UI dependencies as long as they're typed using ModelAnnotation.
*/

export interface ModelAnnotation {
  ModelID: string;
  PatientID: string;
  CellLineName: string;
  StrippedCellLineName: string;
  DepmapModelType: string;
  OncotreeLineage: string;
  OncotreePrimaryDisease: string;
  OncotreeSubtype: string;
  OncotreeCode: string;
  RRID: string;
  Age: string;
  AgeCategory: string;
  Sex: string;
  PatientRace: string;
  PrimaryOrMetastasis: string;
  SampleCollectionSite: string;
  SourceType: string;
  SourceDetail: string;
  GrowthPattern: string;
  OnboardedMedia: string;
  FormulationID: string;
  EngineeredModel: string;
  TissueOrigin: string;
  CCLEName: string;
  CatalogNumber: string;
  PlateCoating: string;
  ModelDerivationMaterial: string;
  PublicComments: string;
  WTSIMasterCellID: string;
  SangerModelID: string;
  COSMICID: string;
  Stage: string;
  CulturedResistanceDrug: string;
  PatientSubtypeFeatures: string;
  PatientTreatmentResponse: string;
  PatientTreatmentStatus: string;
  PediatricModelType: string;
  ModelTreatment: string;
  SerumFreeMedia: string;
  PatientTumorGrade: string;
  PatientTreatmentType: string;
  EngineeredModelDetails: string;
  ModelAvailableInDbgap: string;
  PatientTreatmentDetails: string;
  ModelType: string;
  ModelSubtypeFeatures: string;
  StagingSystem: string;
  ModelIDAlias: string;
  HCMIID: string;
  ImageFilename: string;
}
