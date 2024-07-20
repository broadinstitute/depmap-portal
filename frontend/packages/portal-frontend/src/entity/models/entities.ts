export interface Compound {
  label: string;
  target_or_mechanism?: string;
  target_gene?: Array<Gene>;
  smiles?: string;
  inchikey?: string;
  broadId?: string;
  chemblId?: string;
}

type Gene = {
  // TODO
};

export enum EntityType {
  Gene = "gene",
  Compound = "compound",
}
