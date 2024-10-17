export enum CellignerSampleType {
  TCGA_TUMOR = "tcgaplus-tumor",
  MET500_TUMOR = "met500-tumor",
  DEPMAP_MODEL = "depmap-model",
  NOVARTIS_PDX_MODEL = "novartisPDX-model",
  PEDIATRIC_PDX_MODEL = "pediatricPDX-model",
}

export type CellignerTumorTypes =
  | CellignerSampleType.TCGA_TUMOR
  | CellignerSampleType.MET500_TUMOR;

export type CellignerModelTypes =
  | CellignerSampleType.DEPMAP_MODEL
  | CellignerSampleType.NOVARTIS_PDX_MODEL
  | CellignerSampleType.PEDIATRIC_PDX_MODEL;

export interface Alignments {
  profileId: Array<string>;
  modelConditionId: Array<string>;
  sampleId: Array<string>;
  displayName: Array<string>;
  modelLoaded: Array<boolean>;
  umap1: Array<number>;
  umap2: Array<number>;
  lineage: Array<string>;
  subtype: Array<string>;
  primaryMet: Array<string | null>;
  type: Array<CellignerSampleType>;
  growthPattern: Array<string>;
  cluster: Array<number>;
  cellLineSet: Array<string>;
}

export interface Sample {
  displayName: string;
  sampleId: string;
  profileId: string;
  modelConditionId: string;
  umap1: number;
  umap2: number;
  lineage: string;
  subtype: string;
  cluster: number;
}

export interface Tumor extends Sample {
  type: CellignerTumorTypes;
  pointIndex: number;
}

export interface Model extends Sample {
  type: CellignerModelTypes;

  modelLoaded: boolean;
  pointIndex: number;
}

export type GroupingCategory =
  | "lineage"
  | "subtype"
  | "primaryMet"
  | "growthPattern"
  | "cluster"
  | "type"
  | "cellLineSet"; // Used for color by Model Context

export interface Point {
  x: number;
  y: number;
}
