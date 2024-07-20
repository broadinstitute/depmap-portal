import { CellLineSelectorLines } from "./CellLineSelectorLines";

export interface CellData {
  lineName: string;
  primaryDisease: string;
  lineage1: string;
  lineage2: string;
  lineage3: string;
  //  lineage4: string;
  depmapId: string;
  displayName: string;
  checkbox?: string;
  [key: string]: any;
}

export const loadCellLines = (cellLines: CellLineSelectorLines) => {
  const namesMap = new Map<string, string>([
    ["cell_line_name", "lineName"],
    ["primary_disease", "primaryDisease"],
    ["lineage_1", "lineage1"],
    ["lineage_2", "lineage2"],
    ["lineage_3", "lineage3"],
    //    ["lineage_4", "lineage4"],
    ["depmap_id", "depmapId"],
    ["cell_line_display_name", "displayName"],
  ]);
  const renamedCols: string[] = [];
  cellLines.cols.forEach((col: string) => {
    if (namesMap.has(col)) {
      renamedCols.push(namesMap.get(col) as string);
    } else {
      renamedCols.push(col);
    }
  });
  const loadedData: Map<string, CellData> = new Map<string, CellData>();
  cellLines.data.forEach((cellData) => {
    const cell: any = {};
    renamedCols.forEach((colName, index) => {
      cell[colName] = cellData[index];
    });
    loadedData.set(cell.depmapId, cell);
  });
  return loadedData;
};
