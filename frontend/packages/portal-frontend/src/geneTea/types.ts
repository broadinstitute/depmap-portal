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
