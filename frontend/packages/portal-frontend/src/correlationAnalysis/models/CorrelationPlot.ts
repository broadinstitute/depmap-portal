export type DoseCategoryVolcanoData = {
  [doseCategory: string]: {
    x: number[];
    y: number[];
    label: string[];
    text: string[];
    isSignificant: boolean[];
    name: string;
    color?: string;
  };
};

export type VolcanoDataForCorrelatedDataset = {
  [featureDataset: string]: DoseCategoryVolcanoData;
};

export interface SortedCorrelations {
  id: string;
  feature: string;
  dose: string | undefined;
  featureDataset: string;
  featureDatasetGivenId: string;
  correlation: number;
  log10qvalue: number;
  rank: number;
  [key: string]: any; // in case other keys added
}
