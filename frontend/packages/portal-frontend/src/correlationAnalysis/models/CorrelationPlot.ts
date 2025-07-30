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
