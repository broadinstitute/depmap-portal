import * as React from "react";
import { LongTable, LongTableColumn } from "@depmap/long-table";
import { GenesetSummary } from "src/constellation/models/constellation";
import { createOverrepresentationList } from "src/celfie/utilities/overrepresentationTableUtils";
import { OverrepresentationData } from "../models/overrepresentationModel";

export interface LongTableOverrepresentationProps {
  geneSetsUp: GenesetSummary;
  geneSetsDown: GenesetSummary;
  columns: Array<LongTableColumn>;
}

export default class LongTableOverrepresentation extends React.Component<LongTableOverrepresentationProps> {
  render() {
    const { geneSetsUp, geneSetsDown, columns } = this.props;
    const genesetList = createOverrepresentationList(geneSetsUp, geneSetsDown);
    const genesetIdsConcat = genesetList.reduce(
      (acc: string, curr: OverrepresentationData) => {
        return acc + curr.idCol;
      },
      ""
    );
    return (
      <LongTable
        dataFromProps={genesetList}
        columns={columns}
        // addCheckboxes={true}
        idCol="idCol"
        hiddenCols={["idCol"]}
        // onCheckboxClick={}
        key={genesetIdsConcat} // might really only be needed with checkbox
      />
    );
  }
}
