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
}

export interface TermCluster {
  term: string[];
  cluster: number[];
  order: number[];
}

export interface GeneCluster {
  gene: string[];
  cluster: number[];
  order: number[];
}

export interface TermToEntity {
  term: string[];
  gene: string[];
  count: number[];
  nTerms: number[];
  fraction: number[];
}

export interface FrequentTerms {
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
}

export interface AllEnrichedTerms extends FrequentTerms {
  termGroup: string[];
}

export interface EnrichedTerms extends AllEnrichedTerms {
  negLogFDR: number[];
  clippedTerm: string[];
}

export interface GeneTeaEnrichedTerms {
  validGenes: string[];
  invalidGenes: string[];
  totalNEnrichedTerms: number;
  totalNTermGroups: number;
  groupby: string;
  enrichedTerms: EnrichedTerms | null;
  termCluster: TermCluster | null;
  geneCluster: GeneCluster | null;
  termToEntity: TermToEntity | null;
  frequentTerms: FrequentTerms | null;
  allEnrichedTerms: AllEnrichedTerms | null;
}
