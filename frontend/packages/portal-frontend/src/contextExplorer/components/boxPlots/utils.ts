import { BoxCardData, BoxData, ContextPlotBoxData } from "@depmap/types";
import { BoxPlotInfo } from "src/contextExplorer/models/types";

export const GeneEntityBoxColorList = [
  { r: 53, g: 132, b: 181 },
  { r: 58, g: 123, b: 195 },
  { r: 82, g: 40, b: 142 },
  { r: 123, g: 140, b: 178 },
];

export const CompoundEntityBoxColorList = [
  { r: 102, g: 153, b: 51 },
  { r: 102, g: 153, b: 51 },
];

export const InsignificantColor = { r: 255, g: 255, b: 255 };

const formatBoxData = (
  boxData: BoxData[],
  insigBoxData: BoxData,
  levelZeroCode: string,
  count: number,
  EntityBoxColorList: {
    r: number;
    g: number;
    b: number;
  }[]
) => {
  const formattedBoxData: BoxPlotInfo[] = [];

  for (let index = 0; index < boxData.length; index++) {
    const code =
      boxData[index].path.length === 1
        ? boxData[index].path[0]
        : boxData[index].path[-1];

    const box = boxData[index];

    if (code !== levelZeroCode) {
      const info = {
        name: box.path!.join("/"),
        hoverLabels: box.cell_line_display_names,
        xVals: box.data,
        color: {
          ...EntityBoxColorList[count],
          a: 0.4,
        },
        lineColor: "#000000",
      };
      formattedBoxData.push(info);
    }
  }

  if (insigBoxData?.data && insigBoxData.data.length > 0) {
    formattedBoxData.unshift({
      name: insigBoxData.label,
      hoverLabels: insigBoxData.cell_line_display_names,
      xVals: insigBoxData.data,
      color: InsignificantColor,
      lineColor: "#000000",
      pointLineColor: "#000000",
    });
  }

  return [...formattedBoxData].reverse();
};

export function formatSignificantBoxPlotDataCards(
  boxPlotData: ContextPlotBoxData,
  boxCardCount: number,
  EntityBoxColorList: {
    r: number;
    g: number;
    b: number;
  }[]
) {
  let startingBoxCardCount = boxCardCount;
  const formattedCards = boxPlotData.other_cards.map(
    (cardData: BoxCardData) => {
      startingBoxCardCount += 1;
      if (startingBoxCardCount > EntityBoxColorList.length - 1) {
        startingBoxCardCount = 1;
      }
      const level0Data = cardData.significant.find(
        (val) => val.path.length === 1 && val.path[0] === cardData.level_0_code
      )!;
      return {
        [cardData.level_0_code]: {
          levelZeroPlotInfo: level0Data
            ? {
                name: level0Data.label,
                hoverLabels: level0Data.cell_line_display_names,
                xVals: level0Data.data,
                color: { ...EntityBoxColorList[startingBoxCardCount], a: 0.4 },
                lineColor: "#000000",
              }
            : undefined,
          subContextInfo: formatBoxData(
            cardData.significant,
            cardData.insignificant,
            cardData.level_0_code,
            startingBoxCardCount,
            EntityBoxColorList
          ),
        },
      };
    }
  );

  return formattedCards;
}
