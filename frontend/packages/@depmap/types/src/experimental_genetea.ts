export interface GeneTeaTableRow {
  term: string;
  termGroup: string;
  synonyms: string;
  matchingGenesInList: string;
  nMatchingGenesOverall: number;
  nMatchingGenesInList: number;
  fdr: number;
  effectSize: number;
}

type GeneSymbol = string;
type FractionMatching = number | null;
type TermOrTermGroup = string;

export interface HeatmapFormattedData {
  x: GeneSymbol[];
  y: TermOrTermGroup[];
  z: FractionMatching[];
  customdata: string[]; // For hover text
}

export interface BarChartFormattedData {
  x: number[];
  y: TermOrTermGroup[];
  customdata: string[]; // For hover text
}

export interface TermCluster {
  termOrTermGroup: string[];
  cluster: number[];
  order: number[];
}

export interface GeneCluster {
  gene: string[];
  cluster: number[];
  order: number[];
}

export interface TermToEntity {
  termOrTermGroup: string[];
  gene: string[];
  count: number[];
  nTerms: number[];
  fraction: number[];
}

export interface Terms {
  term: string[];
  matchingGenesInList: string[];
  nMatchingGenesOverall: number[];
  nMatchingGenesInList: number[];
  pVal: number[];
  fdr: number[];
  stopword: boolean[];
  synonyms: string[][];
  totalInfo: number[];
  effectSize: number[];
  negLogFDR: number[];
}

export interface FrequentTerms extends Terms {
  enriched: boolean[];
}

export interface AllEnrichedTerms extends Terms {
  termGroup: string[];
}

export interface EnrichedTerms extends AllEnrichedTerms {
  clippedTerm: string[];
}

export interface GeneTeaEnrichedTerms {
  validGenes: string[];
  invalidGenes: string[];
  totalNEnrichedTerms: number;
  totalNTermGroups: number;
  groupby: "Term" | "Term Group";
  enrichedTerms: EnrichedTerms | null;
  termCluster: TermCluster | null;
  geneCluster: GeneCluster | null;
  termToEntity: TermToEntity | null;
  frequentTerms: FrequentTerms | null;
  allEnrichedTerms: AllEnrichedTerms | null;
}
