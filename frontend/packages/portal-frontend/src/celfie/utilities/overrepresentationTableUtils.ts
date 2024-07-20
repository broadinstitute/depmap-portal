import { GenesetSummary } from "src/constellation/models/constellation";
import { OverrepresentationData } from "src/celfie/models/overrepresentationModel";

export function reformatData(
  index: number,
  data: GenesetSummary,
  direction: string
): OverrepresentationData {
  const geneData: OverrepresentationData = {
    idCol: `${direction}_${data.term[index]}`,
    direction,
    geneset: data.term[index],
    negLogP: data.neg_log_p[index],
    setSize:
      data.genes[index]
        .length /* This should be size of all the genes in geneset? TBD */,
  };
  return geneData;
}

export function createOverrepresentationList(
  genesetsUp: GenesetSummary,
  genesetsDown: GenesetSummary
): Array<OverrepresentationData> {
  const genesetList = [];
  for (let i = 0; i < genesetsUp.rank.length; i += 1) {
    const geneData = reformatData(i, genesetsUp, "Pos");
    genesetList.push(geneData);
  }
  for (let i = 0; i < genesetsDown.rank.length; i += 1) {
    const geneData = reformatData(i, genesetsDown, "Neg");
    genesetList.push(geneData);
  }
  return genesetList.sort((a, b) => {
    return b.negLogP - a.negLogP;
  });
}
