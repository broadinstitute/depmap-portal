export enum CompoundDimensionTypes {
  compound_v2 = "compound_v2",
  compound_dose = "compound_dose",
}

export enum AUCDatasets {
  Prism_oncology_AUC_collapsed = "Prism_oncology_AUC_collapsed",
  GDSC2_AUC_collapsed = "GDSC2_AUC_collapsed",
  GDSC1_AUC_collapsed = "GDSC1_AUC_collapsed",
  CTRP_AUC_collapsed = "CTRP_AUC_collapsed",
  REPURPOSING_AUC_collapsed = "REPURPOSING_AUC_collapsed",
}

export enum ViabilityDatasets {
  Prism_oncology_viability = "Prism_oncology_viability",
  GDSC2_Viability = "GDSC2_Viability",
  GDSC1_Viability = "GDSC1_Viability",
  CTRP_Viability = "CTRP_Viability",
  REPURPOSING_Viability = "REPURPOSING_Viability",
}

export enum DoseReplicateDatasets {
  Prism_oncology_dose_replicate = "Prism_oncology_dose_replicate",
  GDSC2_dose_replicate = "GDSC2_dose_replicate",
  GDSC1_dose_replicate = "GDSC1_dose_replicate",
  CTRP_dose_replicate = "CTRP_dose_replicate",
  Repurposing_secondary_dose_replicate = "Repurposing_secondary_dose_replicate",
}

export type CompoundDatasetGivenIds =
  | AUCDatasets
  | ViabilityDatasets
  | DoseReplicateDatasets;

export const getDimTypeFromGivenID = (givenId: string) => {
  if (Object.values(AUCDatasets).includes(givenId as AUCDatasets)) {
    return CompoundDimensionTypes.compound_v2;
  }

  return CompoundDimensionTypes.compound_dose;
};
