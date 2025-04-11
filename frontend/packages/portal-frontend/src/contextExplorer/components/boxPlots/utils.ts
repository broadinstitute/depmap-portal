import {
  BoxCardData,
  BoxData,
  BoxPlotInfo,
  ContextPlotBoxData,
} from "src/contextExplorer/models/types";

export const EntityBoxColorList = [
  { r: 53, g: 15, b: 138 },
  { r: 170, g: 51, b: 106 },
  { r: 0, g: 109, b: 91 },
  { r: 233, g: 116, b: 81 },
  { r: 139, g: 0, b: 0 },
  { r: 254, g: 52, b: 126 },
  { r: 0, g: 100, b: 0 },
  { r: 138, g: 154, b: 91 },
  { r: 152, g: 251, b: 152 },
  { r: 138, g: 43, b: 226 },
  { r: 0, g: 191, b: 255 },
];

export const InsignificantColor = { r: 255, g: 255, b: 255 };

const formatBoxData = (
  boxData: BoxData[],
  insigBoxData: BoxData,
  levelZeroCode: string,
  count: number
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
  boxCardCount: number
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
          levelZeroPlotInfo: {
            name: level0Data.label,
            hoverLabels: level0Data.cell_line_display_names,
            xVals: level0Data.data,
            color: { ...EntityBoxColorList[startingBoxCardCount], a: 0.4 },
            lineColor: "#000000",
          },
          subContextInfo: formatBoxData(
            cardData.significant,
            cardData.insignificant,
            cardData.level_0_code,
            startingBoxCardCount
          ),
        },
      };
    }
  );

  return formattedCards;
}
