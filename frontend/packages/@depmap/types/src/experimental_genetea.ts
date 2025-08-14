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
type MatchesNumber = number;

export interface HeatmapFormattedData {
  x: GeneSymbol[];
  y: TermOrTermGroup[];
  z: FractionMatching[];
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
  totalNEnrichedTerms: number;
  totalNTermGroups: number;
  groupby: string;
  enrichedTerms: EnrichedTerms;
  termCluster: TermCluster;
  geneCluster: GeneCluster;
  termToEntity: TermToEntity;
  frequentTerms: FrequentTerms;
  allEnrichedTerms: AllEnrichedTerms;
}
